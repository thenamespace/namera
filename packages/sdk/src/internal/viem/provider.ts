// viem's pieces an EIP-1193 provider over the agent's account is built from: a bundler client per paymaster, sending a
// user operation while noting its nonce, the bundler's raw receipt, and the node's JSON-RPC for forwarded reads.
import * as Effect from "effect/Effect"
import * as Predicate from "effect/Predicate"
import type { Client, Transport } from "viem"
import {
  createBundlerClient,
  type RpcUserOperationReceipt,
  sendUserOperation as viemSendUserOperation,
  type SmartAccount,
  type UserOperation
} from "viem/account-abstraction"
import { getAction } from "viem/utils"

import type * as ChainError from "../../ChainError.ts"
import type { NameraError } from "../../NameraError.ts"
import { fromUnknown } from "../chainError.ts"
import type { Call } from "../core/account/erc7579.ts"
import { decode } from "../decode.ts"
import { isNameraError } from "../nameraError.ts"
import { redactUrls } from "../redact.ts"
import { context, type Hex, type ReadClient } from "./client.ts"
import type { BundlerClient } from "./smartAccount.ts"

/**
 * A user operation's receipt as the bundler answers `eth_getUserOperationReceipt`: quantities in hex.
 */
export type { RpcUserOperationReceipt }

/**
 * What a bundler client is configured with besides its account and client: the transport, the fee hook and the
 * paymaster, as the `Bundler.*` and `Paymaster.*` helpers return them.
 *
 * @internal
 */
export interface BundlerConfig {
  readonly transport: Transport
  readonly userOperation?: { readonly estimateFeesPerGas?: ((parameters: never) => Promise<unknown>) | undefined }
  readonly paymaster?: object | undefined
}

/**
 * A bundler client for the account on the client's chain.
 *
 * @internal
 */
export const bundlerClient = (account: SmartAccount, client: ReadClient, config: BundlerConfig): BundlerClient =>
  createBundlerClient({
    account,
    client: client as Client,
    transport: config.transport,
    userOperation: config.userOperation as never,
    ...(config.paymaster === undefined ? {} : { paymaster: config.paymaster as never })
  }) as unknown as BundlerClient

/**
 * Sends a user operation with the calls, returning its hash and the nonce it was signed with. A failure is the Namera
 * error it stands for (a policy refusal from the account's hooks, a bundler's or paymaster's refusal), or a
 * `ChainError`.
 *
 * @internal
 */
export const sendCalls = (
  client: BundlerClient,
  options: { readonly account: SmartAccount; readonly calls: ReadonlyArray<Call> }
): Effect.Effect<{ readonly hash: Hex; readonly nonce: bigint }, NameraError> => {
  let nonce = BigInt(0)
  // viem signs the operation it prepared, so the signing hook sees the nonce it was given.
  const account: SmartAccount = {
    ...options.account,
    signUserOperation: (operation: UserOperation) => {
      nonce = operation.nonce
      return options.account.signUserOperation(operation as never)
    }
  } as SmartAccount
  return Effect.tryPromise({
    try: () =>
      getAction(client, viemSendUserOperation, "sendUserOperation")({ account, calls: [...options.calls] } as never),
    catch: (cause) => {
      const decoded = decode(cause)
      return isNameraError(decoded) ? decoded : fromUnknown(cause, context(client, "eth_sendUserOperation"))
    }
  }).pipe(Effect.map((hash) => ({ hash, nonce })))
}

/**
 * The bundler's receipt of a user operation, or `null` while it has none.
 *
 * @internal
 */
export const userOperationReceipt = (
  client: BundlerClient,
  hash: Hex
): Effect.Effect<RpcUserOperationReceipt<"0.7"> | null, ChainError.ChainError> =>
  Effect.tryPromise({
    try: () =>
      client.request({ method: "eth_getUserOperationReceipt", params: [hash] } as never) as Promise<
        RpcUserOperationReceipt<"0.7"> | null
      >,
    catch: (cause) => fromUnknown(cause, context(client, "eth_getUserOperationReceipt"))
  })

/**
 * A JSON-RPC error as an EIP-1193 provider rejects with: the code and data of the first error in viem's chain that has
 * a code, and viem's short message.
 *
 * @internal
 */
export interface RpcFailure {
  readonly code: number | undefined
  readonly message: string
  readonly data: unknown
}

const withCode = (error: unknown): { readonly code: number; readonly data?: unknown } | undefined => {
  for (let current = error; Predicate.isObject(current); current = (current as { readonly cause?: unknown }).cause) {
    if (Predicate.hasProperty(current, "code") && Predicate.isNumber(current.code)) {
      return current as { readonly code: number; readonly data?: unknown }
    }
  }
  return undefined
}

/**
 * Sends a JSON-RPC request to the client's node as it is. A failure keeps the node's code and data.
 *
 * @internal
 */
export const forward = (
  client: ReadClient,
  request: { readonly method: string; readonly params?: unknown }
): Effect.Effect<unknown, RpcFailure> =>
  Effect.tryPromise({
    try: () => client.request(request as never),
    catch: (error) => {
      const coded = withCode(error)
      const message = Predicate.hasProperty(error, "shortMessage") && Predicate.isString(error.shortMessage)
        ? error.shortMessage
        : String(error)
      return { code: coded?.code, message: redactUrls(message), data: coded?.data }
    }
  })
