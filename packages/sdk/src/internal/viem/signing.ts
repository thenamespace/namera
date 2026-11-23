// Owner signing and the hashing it needs, through viem's wallet actions: local keys sign locally, JSON-RPC accounts
// through the client.
import * as Effect from "effect/Effect"
import type { SignableMessage, TypedDataDefinition } from "viem"
import { getAddress, hashMessage, hashTypedData, toPrefixedMessage } from "viem"
import { signMessage, signTypedData } from "viem/actions"
import { wrapTypedDataSignature } from "viem/experimental/erc7739"

import * as AccountError from "../../accounts/AccountError.ts"
import type { ChainClient, Hex, Owner } from "./client.ts"

/**
 * A message to sign: a string, or raw bytes or hex.
 *
 * @internal
 */
export type { SignableMessage }

/**
 * EIP-712 typed data with its domain, types, primary type and message.
 *
 * @internal
 */
export type { TypedDataDefinition }

/**
 * Hashing and address helpers the accounts use.
 *
 * @internal
 */
export { getAddress, hashMessage, hashTypedData, toPrefixedMessage }

/**
 * Signs as the owner. Failures become `AccountError` (`SigningFailed`) with the wallet's or viem's error as cause.
 *
 * @internal
 */
export const ownerSigner = (client: ChainClient, owner: Owner, account: AccountError.Options["account"]) => {
  const failed = (cause: unknown) => AccountError.signingFailed({ account, cause })
  return {
    signMessage: (message: SignableMessage): Effect.Effect<Hex, AccountError.AccountError> =>
      Effect.tryPromise({ try: () => signMessage(client, { account: owner, message }), catch: failed }),
    signTypedData: (typedData: TypedDataDefinition): Effect.Effect<Hex, AccountError.AccountError> =>
      Effect.tryPromise({
        try: () => signTypedData(client, { account: owner, ...typedData } as Parameters<typeof signTypedData>[1]),
        catch: failed
      })
  }
}

/**
 * Wraps an ERC-7739 `TypedDataSign` signature with the app's domain, contents and type description, as the account
 * expects it.
 *
 * @internal
 */
export const wrapTypedData = (typedData: TypedDataDefinition, signature: Hex): Hex =>
  wrapTypedDataSignature({ ...typedData, signature } as Parameters<typeof wrapTypedDataSignature>[0])
