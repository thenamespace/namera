// The viem client calls Namera makes, with failures translated to `ChainError` and their context (method, chain,
// endpoint). This folder is the only place that imports viem (lint rule `namera/viem-in-adapter`), so supporting
// another viem major means another adapter, not changes across the SDK.
import * as Effect from "effect/Effect"
import * as Predicate from "effect/Predicate"
import type { Chain, Client, Hex, JsonRpcAccount, LocalAccount, PrivateKeyAccount, Transport } from "viem"
import { call as viemCall, getCode, getStorageAt } from "viem/actions"

import type * as ChainError from "../../ChainError.ts"
import { type Context, fromUnknown } from "../chainError.ts"
import { isPrecompileAnswer, precompileProbe } from "../core/account/webauthn.ts"

/**
 * An account owner: a local key or a JSON-RPC wallet account (EIP-1193), which signs through the client.
 */
export type Owner = LocalAccount | JsonRpcAccount

/**
 * Hex data and addresses.
 */
export type { Hex }

/**
 * A local private key, the only owner an EIP-7702 account can have.
 */
export type { PrivateKeyAccount }

/**
 * A client that reads the chain; its chain may be unknown.
 */
export type ReadClient = Client<Transport, Chain | undefined>

/**
 * The client accounts are built with: it must name its chain, and may carry the owner.
 */
export type AccountClient = Client<Transport, Chain | undefined, Owner | undefined>

/**
 * An account client whose chain is known.
 *
 * @internal
 */
export type ChainClient = Client<Transport, Chain, Owner | undefined>

/**
 * Where a call through `client` goes: the method, the client's chain and its endpoint (an HTTP or WebSocket transport's
 * URL).
 *
 * @internal
 */
export const context = (client: ReadClient, method: string): Context => {
  const url = Predicate.hasProperty(client.transport, "url") && Predicate.isString(client.transport.url)
    ? client.transport.url
    : undefined
  return { method, chainId: client.chain?.id, url }
}

/**
 * Whether the client names its chain, which signing (chain id in signatures) and nonces need.
 *
 * @internal
 */
export const hasChain = (client: AccountClient): client is ChainClient => client.chain !== undefined

/**
 * The code at an address, or `undefined` when there is none.
 *
 * @internal
 */
export const code = (client: ReadClient, address: Hex): Effect.Effect<Hex | undefined, ChainError.ChainError> =>
  Effect.tryPromise({
    try: async () => {
      const code = await getCode(client, { address })
      return code === undefined || code === "0x" ? undefined : code
    },
    catch: (cause) => fromUnknown(cause, context(client, "eth_getCode"))
  })

/**
 * A storage word at an address.
 *
 * @internal
 */
export const storageAt = (
  client: ReadClient,
  address: Hex,
  slot: Hex
): Effect.Effect<Hex | undefined, ChainError.ChainError> =>
  Effect.tryPromise({
    try: () => getStorageAt(client, { address, slot }),
    catch: (cause) => fromUnknown(cause, context(client, "eth_getStorageAt"))
  })

/**
 * The return data of a call.
 *
 * @internal
 */
export const call = (
  client: ReadClient,
  request: { readonly to: Hex; readonly data: Hex }
): Effect.Effect<Hex | undefined, ChainError.ChainError> =>
  Effect.tryPromise({
    try: async () => (await viemCall(client, { to: request.to, data: request.data })).data,
    catch: (cause) => fromUnknown(cause, context(client, "eth_call"))
  })

// One probe per client: whether its chain has the P-256 precompile does not change.
const precompiles = new WeakMap<ReadClient, Promise<boolean>>()

/**
 * Whether the client's chain has the P-256 precompile at `0x100` (RIP-7212 / EIP-7951), probed once per client with
 * RIP-7212's test vector.
 *
 * @internal
 */
export const hasP256Precompile = (client: ReadClient): Effect.Effect<boolean, ChainError.ChainError> =>
  Effect.suspend(() => {
    const cached = precompiles.get(client)
    if (cached !== undefined) return Effect.promise(() => cached)
    return call(client, precompileProbe).pipe(
      Effect.map(isPrecompileAnswer),
      Effect.tap((answer) => Effect.sync(() => precompiles.set(client, Promise.resolve(answer))))
    )
  })
