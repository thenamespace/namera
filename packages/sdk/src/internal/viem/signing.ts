// Owner signing and the hashing it needs, through viem's wallet actions: local keys sign locally, JSON-RPC accounts
// through the client.
import * as Effect from "effect/Effect"
import * as Signature from "ox/Signature"
import type { SignableMessage, TypedDataDefinition } from "viem"
import { getAddress, hashMessage, hashTypedData, toPrefixedMessage } from "viem"
import type { WebAuthnAccount } from "viem/account-abstraction"
import { signMessage, signTypedData } from "viem/actions"
import { wrapTypedDataSignature } from "viem/experimental/erc7739"

import * as AccountError from "../../accounts/AccountError.ts"
import { type Assertion, toAssertion } from "../core/account/webauthn.ts"
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

/**
 * A passkey owner: viem's WebAuthn account, which signs through the browser's or the device's authenticator.
 */
export type { WebAuthnAccount }

/**
 * Whether an owner is a passkey.
 *
 * @internal
 */
export const isWebAuthnAccount = (owner: Owner | WebAuthnAccount): owner is WebAuthnAccount => owner.type === "webAuthn"

/**
 * A passkey owner's signer: it signs a challenge with the passkey (one WebAuthn prompt) and returns the assertion the
 * WebAuthn validator reads.
 *
 * @internal
 */
export const passkeySigner = (owner: WebAuthnAccount, account: AccountError.Options["account"]) => ({
  sign: (challenge: Hex): Effect.Effect<Assertion, AccountError.AccountError> =>
    Effect.tryPromise({
      try: () => owner.sign({ hash: challenge }),
      catch: (cause) => AccountError.signingFailed({ account, cause })
    }).pipe(Effect.map(({ signature, webauthn }) => {
      const { r, s } = Signature.fromHex(signature)
      return toAssertion({ publicKey: owner.publicKey, r: BigInt(r), s: BigInt(s), ...webauthn })
    }))
})
