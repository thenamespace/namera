// viem's smart account and bundler APIs: building an account from an implementation (`toSmartAccount` in viem 2,
// `SmartAccount.from` in viem 3), the EntryPoint, and the bundler actions Namera sends through.
import * as Effect from "effect/Effect"
import type { Chain, Client, TransactionReceipt, Transport } from "viem"
import {
  entryPoint07Abi,
  entryPoint07Address,
  getUserOperationHash,
  sendUserOperation as viemSendUserOperation,
  type SmartAccount,
  type SmartAccountImplementation,
  toSmartAccount,
  waitForUserOperationReceipt as viemWaitForUserOperationReceipt
} from "viem/account-abstraction"
import { readContract } from "viem/actions"
import { getAction } from "viem/utils"

import type * as ChainError from "../../ChainError.ts"
import { fromUnknown } from "../chainError.ts"
import type { Call } from "../core/account/erc7579.ts"
import { type ChainClient, context, type Hex } from "./client.ts"

/**
 * viem's smart account and the implementation it is built from.
 */
export type { SmartAccount, SmartAccountImplementation }

/**
 * A transaction receipt.
 */
export type { TransactionReceipt }

/**
 * The EntryPoint 0.7 every supported account uses.
 *
 * @internal
 */
export const entryPoint = { abi: entryPoint07Abi, address: entryPoint07Address, version: "0.7" } as const

/**
 * The EntryPoint 0.7 ABI, for typing implementations.
 *
 * @internal
 */
export type EntryPointAbi = typeof entryPoint07Abi

/**
 * A bundler client: any viem client with a smart account.
 */
export type BundlerClient = Client<Transport, Chain | undefined, SmartAccount | undefined>

/**
 * Builds viem's smart account from an implementation.
 *
 * @internal
 */
export const build = <const implementation extends SmartAccountImplementation>(
  implementation: implementation
): Promise<SmartAccount<implementation>> => toSmartAccount(implementation) as Promise<SmartAccount<implementation>>

/**
 * The hash a user operation's owner signs.
 *
 * @internal
 */
export const userOperationHash = (options: {
  readonly userOperation: Parameters<SmartAccountImplementation["signUserOperation"]>[0]
  readonly sender: Hex
  readonly chainId: number
}): Hex => {
  const { chainId = options.chainId, ...operation } = options.userOperation
  return getUserOperationHash({
    userOperation: { ...operation, sender: operation.sender ?? options.sender, signature: "0x" },
    entryPointAddress: entryPoint.address,
    entryPointVersion: entryPoint.version,
    chainId
  })
}

/**
 * The EntryPoint nonce of `account` on lane `key`.
 *
 * @internal
 */
export const nonce = (client: ChainClient, account: Hex, key: bigint): Effect.Effect<bigint, ChainError.ChainError> =>
  Effect.tryPromise({
    try: () =>
      readContract(client, {
        address: entryPoint.address,
        abi: entryPoint.abi,
        functionName: "getNonce",
        args: [account, key]
      }),
    catch: (cause) => fromUnknown(cause, context(client, "eth_call"))
  })

/**
 * Sends a user operation through the bundler client, returning its hash.
 *
 * @internal
 */
export const sendUserOperation = (
  client: BundlerClient,
  options: { readonly account: SmartAccount; readonly calls: ReadonlyArray<Call> }
): Effect.Effect<Hex, ChainError.ChainError> =>
  Effect.tryPromise({
    try: () =>
      getAction(client, viemSendUserOperation, "sendUserOperation")({
        account: options.account,
        calls: [...options.calls]
      } as never),
    catch: (cause) => fromUnknown(cause, context(client, "eth_sendUserOperation"))
  })

/**
 * Waits for a user operation and returns whether it succeeded, with its transaction receipt.
 *
 * @internal
 */
export const waitForUserOperationReceipt = (
  client: BundlerClient,
  hash: Hex
): Effect.Effect<{ readonly success: boolean; readonly receipt: TransactionReceipt }, ChainError.ChainError> =>
  Effect.tryPromise({
    try: () => getAction(client, viemWaitForUserOperationReceipt, "waitForUserOperationReceipt")({ hash }),
    catch: (cause) => fromUnknown(cause, context(client, "eth_getUserOperationReceipt"))
  })
