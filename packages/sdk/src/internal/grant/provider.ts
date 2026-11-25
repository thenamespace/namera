import * as Effect from "effect/Effect"
import * as Predicate from "effect/Predicate"
import type * as Result from "effect/Result"
import * as Address from "ox/Address"
import * as Hex from "ox/Hex"

import type * as AccountError from "../../accounts/AccountError.ts"
import type * as ChainError from "../../ChainError.ts"
import type * as GrantError from "../../GrantError.ts"
import type * as Bundler from "../../infra/Bundler.ts"
import * as Paymaster from "../../infra/Paymaster.ts"
import type { NameraError } from "../../NameraError.ts"
import type * as core from "../core/grant/grant.ts"
import { isNameraError } from "../nameraError.ts"
import { run } from "../promise.ts"
import { annotate, chainIdsOf, ofGrant, traced } from "../span.ts"
import type { ChainClient, ReadClient } from "../viem/client.ts"
import { bundlerClient, forward, sendCalls, userOperationReceipt } from "../viem/provider.ts"
import type { TypedDataDefinition } from "../viem/signing.ts"
import { type BundlerClient, nonce } from "../viem/smartAccount.ts"
import * as Eip5792 from "./eip5792.ts"
import { codes, fromNameraError, make, ProviderRpcError } from "./providerError.ts"
import { type Signer, toAccount } from "./toAccount.ts"
import * as TypedDataJson from "./typedDataJson.ts"

// The agent's account as an EIP-1193 provider, for wagmi and other tools that expect a wallet: it answers the account
// and chain, EIP-5792's wallet call API (each batch is one user operation through the bundler, sponsored by the
// batch's ERC-7677 `paymasterService` or the provider's paymaster), and typed data with the session key. Reads go to
// the node; anything else that would sign or send is refused with 4200, since only the session key's user operations
// and typed data act for the account.

/**
 * What `Grant.toProvider` takes.
 *
 * @internal
 */
export interface Options {
  readonly grant: core.Grant
  readonly signer: Signer | ReadonlyArray<Signer>
  readonly client: ReadClient
  readonly bundler: Bundler.Bundler
  readonly paymaster?: Paymaster.Paymaster | undefined
  readonly lane?: number | undefined
  readonly check?: boolean | undefined
}

/**
 * The events the provider emits, with their payloads.
 */
export interface Events {
  readonly connect: { readonly chainId: string }
  readonly disconnect: { readonly code: number; readonly message: string }
  readonly chainChanged: string
  readonly accountsChanged: ReadonlyArray<string>
}

/**
 * An EIP-1193 provider.
 */
export interface Provider {
  readonly request: (args: { readonly method: string; readonly params?: unknown }) => Promise<unknown>
  readonly on: <E extends keyof Events>(event: E, listener: (payload: Events[E]) => void) => void
  readonly removeListener: <E extends keyof Events>(event: E, listener: (payload: Events[E]) => void) => void
}

/** A batch this provider sent: its operation's hash and the nonce it was signed with. */
interface Sent {
  readonly hash: Hex.Hex
  readonly nonce: bigint
}

type Failure = NameraError | ProviderRpcError

const failWith = <A>(result: Result.Result<A, ProviderRpcError>): Effect.Effect<A, ProviderRpcError> =>
  Effect.fromResult(result)

const fail = (code: number, message: string) => Effect.fail(make(code, message))

// Signing and sending: only what the session key does through the provider's own methods.
const isRefused = (method: string) =>
  /^(wallet_|personal_|eth_sign|eth_send)/.test(method) || !/^(eth_|net_|web3_)/.test(method)

/**
 * Builds the agent's EIP-1193 provider for a grant on the client's chain.
 *
 * @internal
 */
export const toProvider = Effect.fnUntraced(function*(
  options: Options
): Effect.fn.Return<Provider, AccountError.AccountError | ChainError.ChainError | GrantError.GrantError> {
  yield* annotate({ chainId: chainIdsOf(options.client), ...ofGrant(options.grant) })
  const { client } = options
  const account = yield* toAccount(client, {
    grant: options.grant,
    signer: options.signer,
    lane: options.lane,
    check: options.check
  })
  // `toAccount` refuses a client without a chain.
  const chainId = client.chain!.id
  const hexChainId = Hex.fromNumber(chainId)
  const address = account.address

  const base = bundlerClient(account, client, { ...options.bundler, paymaster: options.paymaster })
  // One bundler client per paymaster service a batch names, so the bundler's fee hook checks the combination.
  const sponsored = new Map<string, BundlerClient>()
  const clientFor = (service: Eip5792.PaymasterService | undefined) => {
    if (service === undefined) return base
    const key = JSON.stringify([service.url, service.context ?? null])
    const cached = sponsored.get(key)
    if (cached !== undefined) return cached
    const created = bundlerClient(account, client, {
      ...options.bundler,
      paymaster: Paymaster.erc7677({ url: service.url, context: service.context })
    })
    sponsored.set(key, created)
    return created
  }

  const batches = new Map<string, Sent>()
  const reserved = new Set<string>()

  const sendBatch = Effect.fnUntraced(function*(params: unknown): Effect.fn.Return<{ readonly id: string }, Failure> {
    const batch = yield* failWith(Eip5792.parseSendCalls(params, { chainId, address }))
    if (batch.id !== undefined) {
      if (batches.has(batch.id) || reserved.has(batch.id)) {
        return yield* fail(codes.duplicateId, `a batch with id ${batch.id} was already sent`)
      }
      reserved.add(batch.id)
    }
    const sent = yield* sendCalls(clientFor(batch.paymasterService), { account, calls: batch.calls }).pipe(
      Effect.ensuring(Effect.sync(() => batch.id !== undefined && reserved.delete(batch.id)))
    )
    const id = batch.id ?? sent.hash
    batches.set(id, sent)
    return { id }
  }, traced("Namera.Grant.toProvider.sendCalls"))

  const batchStatus = Effect.fnUntraced(function*(params: unknown): Effect.fn.Return<unknown, Failure> {
    const id = Array.isArray(params) ? params[0] : undefined
    if (!Predicate.isString(id)) return yield* fail(codes.invalidParams, "wallet_getCallsStatus takes a batch id")
    const sent = batches.get(id)
    // A batch sent by another provider of the account is found by its id, the operation's hash.
    const hash = sent?.hash ?? (Hex.validate(id) && Hex.size(id) === 32 ? id : undefined)
    const unknown = make(codes.unknownBundle, `no batch with id ${id}`)
    if (hash === undefined) return yield* Effect.fail(unknown)

    // The nonce is read before the receipt: an operation included in between has a receipt.
    const used = sent === undefined ? undefined : yield* nonce(client as ChainClient, address, sent.nonce >> BigInt(64))
    const receipt = yield* userOperationReceipt(base, hash)
    if (receipt === null) {
      if (sent === undefined) return yield* Effect.fail(unknown)
      const dropped = used !== undefined && used > sent.nonce
      return Eip5792.callsStatus({ id, chainId, status: dropped ? Eip5792.status.dropped : Eip5792.status.pending })
    }
    if (!Address.isEqual(receipt.sender, address)) return yield* Effect.fail(unknown)
    return Eip5792.callsStatus({
      id,
      chainId,
      status: receipt.success ? Eip5792.status.confirmed : Eip5792.status.reverted,
      receipt
    })
  }, traced("Namera.Grant.toProvider.getCallsStatus"))

  const fromAccount = (requested: unknown) =>
    Predicate.isString(requested) && Address.validate(requested, { strict: false })
      && Address.isEqual(requested, address)
      ? Effect.void
      : fail(codes.unauthorized, `${String(requested)} is not this provider's account`)

  const fromHook = <A>(sign: () => Promise<A>): Effect.Effect<A, Failure> =>
    Effect.tryPromise({
      try: sign,
      catch: (error) => isNameraError(error) ? error : make(codes.internal, String(error))
    })

  const signTypedData = Effect.fnUntraced(function*(params: unknown): Effect.fn.Return<Hex.Hex, Failure> {
    const [signer, json] = Array.isArray(params) ? params : []
    yield* fromAccount(signer)
    const typedData = TypedDataJson.fromJson(json)
    if (typedData === undefined) return yield* fail(codes.invalidParams, "eth_signTypedData_v4 takes typed data")
    return yield* fromHook(() => account.signTypedData(typedData as unknown as TypedDataDefinition))
  }, traced("Namera.Grant.toProvider.signTypedData"))

  const listeners = new Map<keyof Events, Set<(payload: never) => void>>()
  const emit = <E extends keyof Events>(event: E, payload: Events[E]) => {
    for (const listener of listeners.get(event) ?? []) (listener as (payload: Events[E]) => void)(payload)
  }
  let connected = false

  const handle = (method: string, params: unknown): Effect.Effect<unknown, Failure> => {
    switch (method) {
      case "eth_accounts":
        return Effect.succeed([address])
      case "eth_requestAccounts":
        return Effect.sync(() => {
          if (!connected) {
            connected = true
            emit("connect", { chainId: hexChainId })
            emit("accountsChanged", [address])
          }
          return [address]
        })
      case "eth_chainId":
        return Effect.succeed(hexChainId)
      case "wallet_getCapabilities": {
        const [requested, chainIds] = Array.isArray(params) ? params : []
        const forAccount = requested === undefined || requested === null ? Effect.void : fromAccount(requested)
        const covered = !Array.isArray(chainIds)
          || chainIds.some((id) => Predicate.isString(id) && Hex.validate(id) && Hex.toNumber(id) === chainId)
        return Effect.as(forAccount, covered ? { [hexChainId]: Eip5792.capabilities } : {})
      }
      case "wallet_sendCalls":
        return sendBatch(params)
      case "wallet_getCallsStatus":
        return batchStatus(params)
      case "wallet_switchEthereumChain": {
        const [target] = Array.isArray(params) ? params : []
        const id = Predicate.hasProperty(target, "chainId") ? target.chainId : undefined
        return Predicate.isString(id) && Hex.validate(id) && Hex.toNumber(id) === chainId
          ? Effect.succeed(null)
          : fail(codes.unrecognizedChain, `this provider's account is on chain ${chainId} only`)
      }
      case "eth_signTypedData_v4":
        return signTypedData(params)
      case "personal_sign": {
        const [message, signer] = Array.isArray(params) ? params : []
        if (!Predicate.isString(message) || !Hex.validate(message)) {
          return fail(codes.invalidParams, "personal_sign takes a hex message")
        }
        return Effect.andThen(fromAccount(signer), fromHook(() => account.signMessage({ message: { raw: message } })))
      }
    }
    if (isRefused(method)) return fail(codes.unsupportedMethod, `${method} is not supported by a session key`)
    return forward(client, { method, params }).pipe(
      Effect.mapError((failure) => make(failure.code ?? codes.internal, failure.message, failure.data))
    )
  }

  const provider: Provider = {
    request: (args) => {
      if (!Predicate.isObject(args) || !Predicate.isString(args.method)) {
        return Promise.reject(make(codes.invalidParams, "request takes { method, params }"))
      }
      return run(handle(args.method, args.params)).catch((error: unknown) => {
        if (error instanceof ProviderRpcError) throw error
        if (isNameraError(error)) throw fromNameraError(error)
        throw make(codes.internal, String(error))
      })
    },
    on: (event, listener) => {
      const set = listeners.get(event) ?? new Set()
      set.add(listener as (payload: never) => void)
      listeners.set(event, set)
    },
    removeListener: (event, listener) => {
      listeners.get(event)?.delete(listener as (payload: never) => void)
    }
  }
  return provider
}, traced("Namera.Grant.toProvider"))
