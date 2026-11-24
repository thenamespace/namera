import * as Effect from "effect/Effect"
import * as Predicate from "effect/Predicate"

import { run } from "../../internal/promise.ts"
import {
  type Client,
  getPaymasterData,
  type GetPaymasterDataParameters,
  type GetPaymasterDataReturnType,
  getPaymasterStubData,
  type GetPaymasterStubDataParameters,
  type GetPaymasterStubDataReturnType,
  type HttpTransportConfig,
  paymasterClient,
  vendorTransport
} from "../../internal/viem/infra.ts"
import type { SmartAccount } from "../../internal/viem/smartAccount.ts"
import * as CompatError from "../CompatError.ts"
import { type Endpoint, translate } from "./endpoint.ts"
import type { PaymasterVendor } from "./matrix.ts"
import { DEFAULT_PAYMASTER_VERIFICATION_GAS } from "./vendors/candide.ts"

/**
 * A viem paymaster (`getPaymasterStubData` and `getPaymasterData`, for a bundler client's `paymaster` option) and its
 * vendor, which `Compat.check` reads.
 */
export interface Paymaster {
  readonly vendor: PaymasterVendor
  readonly getPaymasterStubData: (parameters: GetPaymasterStubDataParameters) => Promise<GetPaymasterStubDataReturnType>
  readonly getPaymasterData: (parameters: GetPaymasterDataParameters) => Promise<GetPaymasterDataReturnType>
}

// viem gives a paymaster the operation and the chain, not the account. Namera's bundler helpers record the account
// each operation is prepared for (by sender and chain) before viem asks the paymaster, so Circle's paymaster can have
// the account sign its permit.
const accounts = new WeakMap<object, Map<string, SmartAccount>>()

const accountKey = (chainId: number, address: string) => `${chainId}:${address.toLowerCase()}`

/**
 * Records the account a bundler client prepares an operation for, for its paymaster.
 *
 * @internal
 */
export const bindAccount = (paymaster: object, account: SmartAccount): void => {
  const chainId = account.client.chain?.id
  if (chainId === undefined) return
  const bound = accounts.get(paymaster) ?? new Map<string, SmartAccount>()
  bound.set(accountKey(chainId, account.address), account)
  accounts.set(paymaster, bound)
}

/**
 * The account recorded for an operation's sender on a chain.
 *
 * @internal
 */
export const boundAccount = (paymaster: object, chainId: number, sender: string): SmartAccount | undefined =>
  accounts.get(paymaster)?.get(accountKey(chainId, sender))

/**
 * How one ERC-7677 paymaster is reached: its endpoint per chain (`undefined` where it has none), the context its
 * methods take, the credentials to keep out of errors, and the least call gas it signs for.
 *
 * @internal
 */
export interface Spec {
  readonly vendor: PaymasterVendor
  readonly url: (chainId: number) => string | undefined
  readonly context: unknown
  readonly secrets: ReadonlyArray<string>
  readonly http?: HttpTransportConfig | undefined
  readonly minCallGas?: bigint | undefined
  /** The minimum call gas named in the paymaster's refusal, which it then signs for. */
  readonly minCallGasOf?: ((error: { readonly message: string }) => bigint | undefined) | undefined
}

const notOnChain = (vendor: string, chainId: number) =>
  CompatError.incompatible([{
    code: "NOT_ON_CHAIN",
    message: `the ${vendor} paymaster has no endpoint on chain ${chainId}`
  }])

// The bundler client's `paymasterContext` adds to the helper's context.
const mergeContext = (base: unknown, given: unknown): unknown =>
  given === undefined ? base : Predicate.isObject(base) && Predicate.isObject(given) ? { ...base, ...given } : given

/**
 * An ERC-7677 paymaster. Stub requests send zeroed gas fields; a stub without paymaster verification gas gets 150k
 * (Candide's and Alchemy's ERC-20 stubs omit it, and some bundlers don't estimate it); `pm_getPaymasterData` gets the
 * operation as estimated (with the call gas raised to `minCallGas`), and its answer is returned unchanged.
 *
 * @internal
 */
export const erc7677 = (spec: Spec): Paymaster => {
  const endpoint: Endpoint = { side: "paymaster", vendor: spec.vendor, secrets: spec.secrets }
  const clients = new Map<number, { readonly client: Client; readonly url: string }>()
  const clientFor = (chainId: number) =>
    Effect.suspend(() => {
      const cached = clients.get(chainId)
      if (cached !== undefined) return Effect.succeed(cached)
      const url = spec.url(chainId)
      if (url === undefined) return Effect.fail(notOnChain(spec.vendor, chainId))
      const entry = {
        url,
        client: paymasterClient(vendorTransport({ url: () => url, http: spec.http, translate: translate(endpoint) }))
      }
      clients.set(chainId, entry)
      return Effect.succeed(entry)
    })

  return {
    vendor: spec.vendor,
    getPaymasterStubData: (parameters) =>
      run(Effect.gen(function*() {
        const { client } = yield* clientFor(parameters.chainId)
        const stub = yield* Effect.tryPromise({
          try: () =>
            getPaymasterStubData(client, {
              ...parameters,
              context: mergeContext(spec.context, parameters.context)
            } as GetPaymasterStubDataParameters),
          catch: (error) => translate(endpoint)(error, "pm_getPaymasterStubData")
        })
        return "paymaster" in stub && stub.paymaster !== undefined && stub.paymasterVerificationGasLimit === undefined
          ? { ...stub, paymasterVerificationGasLimit: DEFAULT_PAYMASTER_VERIFICATION_GAS }
          : stub
      })),
    getPaymasterData: (parameters) =>
      run(Effect.gen(function*() {
        const { client } = yield* clientFor(parameters.chainId)
        const callGasLimit = (parameters as { readonly callGasLimit?: bigint | undefined }).callGasLimit
        const request = (raised: bigint | undefined) =>
          Effect.tryPromise({
            try: () =>
              getPaymasterData(client, {
                ...parameters,
                ...(raised === undefined ? {} : { callGasLimit: raised }),
                context: mergeContext(spec.context, parameters.context)
              } as GetPaymasterDataParameters),
            catch: (error) => translate(endpoint)(error, "pm_getPaymasterData")
          }).pipe(Effect.map((data) => ({ data, raised })))
        const floored = spec.minCallGas !== undefined && callGasLimit !== undefined && callGasLimit < spec.minCallGas
          ? spec.minCallGas
          : undefined
        // A paymaster that names the call gas it wants gets asked once more with it.
        const { data, raised } = yield* request(floored).pipe(
          Effect.catchIf(
            (error) => {
              const minimum = spec.minCallGasOf?.(error)
              return minimum !== undefined && minimum > (floored ?? callGasLimit ?? BigInt(0))
            },
            (error) => request(spec.minCallGasOf!(error))
          )
        )
        // viem spreads the answer into the operation, so a raised call gas limit reaches the operation the paymaster
        // signed for.
        return (raised === undefined ? data : { ...data, callGasLimit: raised }) as GetPaymasterDataReturnType
      }))
  }
}
