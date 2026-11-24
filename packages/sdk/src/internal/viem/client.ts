// The viem client calls Namera makes, with failures translated to `ChainError` and their context (method, chain,
// endpoint). This folder is the only place that imports viem (lint rule `namera/viem-in-adapter`), so supporting
// another viem major means another adapter, not changes across the SDK.
import * as Effect from "effect/Effect"
import * as Predicate from "effect/Predicate"
import type { Chain, Client, Hex, JsonRpcAccount, LocalAccount, PrivateKeyAccount, Transport } from "viem"
import {
  call as viemCall,
  getBlock,
  getBlockNumber,
  getCode,
  getStorageAt,
  getTransaction,
  verifyHash as viemVerifyHash,
  watchBlockNumber
} from "viem/actions"

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
  request: { readonly to: Hex; readonly data: Hex; readonly from?: Hex | undefined }
): Effect.Effect<Hex | undefined, ChainError.ChainError> =>
  Effect.tryPromise({
    try: async () =>
      (await viemCall(client, {
        to: request.to,
        data: request.data,
        ...(request.from === undefined ? {} : { account: request.from })
      })).data,
    catch: (cause) => fromUnknown(cause, context(client, "eth_call"))
  })

/**
 * The latest block's timestamp, in seconds.
 *
 * @internal
 */
export const latestTimestamp = (client: ReadClient): Effect.Effect<bigint, ChainError.ChainError> =>
  Effect.tryPromise({
    try: async () => (await getBlock(client, { blockTag: "latest" })).timestamp,
    catch: (cause) => fromUnknown(cause, context(client, "eth_getBlockByNumber"))
  })

/**
 * The latest block's number.
 *
 * @internal
 */
export const blockNumber = (client: ReadClient): Effect.Effect<bigint, ChainError.ChainError> =>
  Effect.tryPromise({
    try: () => getBlockNumber(client, { cacheTime: 0 }),
    catch: (cause) => fromUnknown(cause, context(client, "eth_blockNumber"))
  })

/**
 * A contract's raw logs with `topics` in a block range (inclusive).
 *
 * @internal
 */
export const logs = (
  client: ReadClient,
  request: {
    readonly address: Hex
    readonly topics: ReadonlyArray<Hex | null>
    readonly fromBlock: bigint
    readonly toBlock: bigint
  }
): Effect.Effect<
  ReadonlyArray<{
    readonly data: Hex
    readonly topics: ReadonlyArray<Hex>
    readonly blockNumber: bigint
    readonly transactionHash: Hex
  }>,
  ChainError.ChainError
> =>
  Effect.tryPromise({
    // viem's `getLogs` takes an event and its arguments; the node takes raw topics.
    try: async () => {
      const entries = await client.request({
        method: "eth_getLogs",
        params: [{
          address: request.address,
          topics: [...request.topics],
          fromBlock: `0x${request.fromBlock.toString(16)}`,
          toBlock: `0x${request.toBlock.toString(16)}`
        }]
      } as never) as ReadonlyArray<
        {
          readonly data: Hex
          readonly topics: ReadonlyArray<Hex>
          readonly blockNumber: Hex
          readonly transactionHash: Hex
        }
      >
      return entries.map((entry) => ({
        data: entry.data,
        topics: entry.topics,
        blockNumber: BigInt(entry.blockNumber),
        transactionHash: entry.transactionHash
      }))
    },
    catch: (cause) => fromUnknown(cause, context(client, "eth_getLogs"))
  })

/**
 * A transaction's input data.
 *
 * @internal
 */
export const transactionInput = (client: ReadClient, hash: Hex): Effect.Effect<Hex, ChainError.ChainError> =>
  Effect.tryPromise({
    try: async () => (await getTransaction(client, { hash })).input,
    catch: (cause) => fromUnknown(cause, context(client, "eth_getTransactionByHash"))
  })

/**
 * Calls `onBlock` for the latest block now and for every new one, until the returned function is called.
 *
 * @internal
 */
export const watchBlocks = (
  client: ReadClient,
  options: {
    readonly onBlock: (blockNumber: bigint) => void
    readonly onError?: ((error: ChainError.ChainError) => void) | undefined
    readonly pollingInterval?: number | undefined
  }
): () => void =>
  watchBlockNumber(client, {
    emitOnBegin: true,
    onBlockNumber: options.onBlock,
    onError: (cause) => options.onError?.(fromUnknown(cause, context(client, "eth_blockNumber"))),
    ...(options.pollingInterval === undefined ? {} : { pollingInterval: options.pollingInterval })
  })

/**
 * Whether `signature` is the account's signature of `hash`: ERC-1271 when deployed, ERC-6492 for a wrapped
 * signature of an undeployed account.
 *
 * @internal
 */
export const verifyHash = (
  client: ReadClient,
  request: { readonly address: Hex; readonly hash: Hex; readonly signature: Hex }
): Effect.Effect<boolean, ChainError.ChainError> =>
  Effect.tryPromise({
    try: () => viemVerifyHash(client, { address: request.address, hash: request.hash, signature: request.signature }),
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
