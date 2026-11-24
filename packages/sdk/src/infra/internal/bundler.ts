import * as Effect from "effect/Effect"
import * as Predicate from "effect/Predicate"

import { fromUnknown } from "../../internal/chainError.ts"
import { run } from "../../internal/promise.ts"
import {
  type Client,
  type HttpTransportConfig,
  nodeFees,
  type Transport,
  type UserOperationRequest,
  vendorTransport
} from "../../internal/viem/infra.ts"
import type { SmartAccount } from "../../internal/viem/smartAccount.ts"
import type { NameraError } from "../../NameraError.ts"
import * as CompatError from "../CompatError.ts"
import { check } from "./compat.ts"
import { type Endpoint, request, translate } from "./endpoint.ts"
import type { BundlerVendor, Sponsorship } from "./matrix.ts"
import { bindAccount } from "./paymaster.ts"
import type { Fees, Rpc } from "./vendors/fees.ts"

/**
 * What viem's bundler client passes its `userOperation.estimateFeesPerGas` hook.
 */
export interface FeeParameters {
  // `unknown`, not viem's account type: viem would infer the bundler client's account from this parameter too.
  readonly account: unknown
  readonly bundlerClient: Client
  readonly userOperation: UserOperationRequest
}

/**
 * Configuration for viem's `createBundlerClient`: the transport to the vendor's endpoint and the fee hook, plus the
 * vendor (and the sponsorship the bundler gives itself), which `Compat.check` reads.
 */
export interface Bundler {
  readonly vendor: BundlerVendor
  readonly sponsorship?: Sponsorship | undefined
  readonly transport: Transport
  readonly userOperation: {
    readonly estimateFeesPerGas: (parameters: FeeParameters) => Promise<Fees>
  }
}

/**
 * How one bundler is reached and priced.
 *
 * @internal
 */
export interface Spec {
  readonly vendor: BundlerVendor
  readonly sponsorship?: Sponsorship | undefined
  /** The endpoint on a chain, or `undefined` where the vendor has none. */
  readonly url: (chainId: number | undefined) => string | undefined
  readonly headers?: Readonly<Record<string, string>> | undefined
  readonly secrets: ReadonlyArray<string>
  readonly http?: HttpTransportConfig | undefined
  readonly strict: boolean
  readonly fees: (options: { readonly rpc: Rpc; readonly bundlerClient: Client }) => Effect.Effect<Fees, NameraError>
  /** Adjusts the bundler's answer to `eth_estimateUserOperationGas` (vendor floors and fills). */
  readonly estimate?: ((params: unknown, answer: unknown) => unknown) | undefined
}

const smartAccount = (u: unknown): SmartAccount | undefined =>
  Predicate.hasProperty(u, "address") && Predicate.hasProperty(u, "isDeployed") ? u as SmartAccount : undefined

const zeroFees: Fees = { maxFeePerGas: BigInt(0), maxPriorityFeePerGas: BigInt(0) }

/**
 * Fees from the node behind the bundler client (its `client`), as viem estimates them without a hook.
 *
 * @internal
 */
export const nodeFeesOf = ({ bundlerClient }: { readonly bundlerClient: Client }): Effect.Effect<Fees, NameraError> => {
  const node = (bundlerClient as { readonly client?: Client | undefined }).client ?? bundlerClient
  return Effect.tryPromise({
    try: () => nodeFees(node),
    catch: (cause) => fromUnknown(cause, { method: "eth_feeHistory" })
  })
}

/**
 * Builds a bundler's configuration. Its fee hook, which viem runs first when preparing every operation (when the
 * caller gives no fees), is where the account, the bundler and the paymaster meet: it runs `Compat.check` there and
 * refuses a combination that can't work before anything is signed, then fetches the fees from the vendor.
 *
 * @internal
 */
export const make = (spec: Spec): Bundler => {
  const endpoint: Endpoint = { side: "bundler", vendor: spec.vendor, secrets: spec.secrets }
  const identity = {
    vendor: spec.vendor,
    ...(spec.sponsorship === undefined ? {} : { sponsorship: spec.sponsorship })
  }

  const transport = vendorTransport({
    url: (chain) => {
      const url = spec.url(chain?.id)
      if (url !== undefined) return url
      throw CompatError.incompatible([{
        code: "NOT_ON_CHAIN",
        message: chain === undefined
          ? "the bundler client names no chain: pass `client` (or `chain`) to createBundlerClient"
          : `${spec.vendor} has no bundler endpoint Namera knows on chain ${chain.id}: use Bundler.from with its URL`
      }])
    },
    http: spec.http,
    headers: spec.headers,
    translate: translate(endpoint),
    result: spec.estimate === undefined
      ? undefined
      : (method, params, answer) => method === "eth_estimateUserOperationGas" ? spec.estimate!(params, answer) : answer
  })

  const refuse = Effect.fnUntraced(function*(parameters: FeeParameters) {
    const chainId = parameters.bundlerClient.chain?.id
    if (chainId === undefined) return
    const paymaster = (parameters.bundlerClient as { readonly paymaster?: unknown }).paymaster
    let { problems } = check({ account: parameters.account, bundler: identity, paymaster, chainId })

    // An EIP-7702 account sends its authorization only until it is delegated.
    const account = smartAccount(parameters.account)
    if (account !== undefined && problems.some((problem) => problem.code === "EIP7702_UNSUPPORTED")) {
      const delegated = yield* Effect.tryPromise({
        try: () => account.isDeployed(),
        catch: (cause) => fromUnknown(cause, { method: "eth_getCode", chainId })
      })
      if (delegated) problems = problems.filter((problem) => problem.code !== "EIP7702_UNSUPPORTED")
    }
    if (problems.length > 0) return yield* CompatError.incompatible(problems)
  })

  const estimateFeesPerGas = (parameters: FeeParameters): Promise<Fees> =>
    run(Effect.gen(function*() {
      if (spec.strict) yield* refuse(parameters)
      const paymaster = (parameters.bundlerClient as { readonly paymaster?: unknown }).paymaster
      const account = smartAccount(parameters.account)
      if (account !== undefined && Predicate.isObject(paymaster)) bindAccount(paymaster, account)
      if (spec.sponsorship !== undefined) return zeroFees

      const rpc: Rpc = (method, params = []) => request(parameters.bundlerClient, method, params, endpoint)
      return yield* spec.fees({ rpc, bundlerClient: parameters.bundlerClient })
    }))

  return { ...identity, transport, userOperation: { estimateFeesPerGas } }
}
