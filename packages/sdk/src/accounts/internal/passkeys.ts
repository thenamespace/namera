import * as WebAuthnValidator from "@namera-ai/contracts/WebAuthnValidator"
import * as Effect from "effect/Effect"

import type * as ChainError from "../../ChainError.ts"
import * as WebAuthn from "../../internal/core/account/webauthn.ts"
import { type ChainClient, hasP256Precompile, type Hex } from "../../internal/viem/client.ts"
import { isWebAuthnAccount, passkeySigner, type WebAuthnAccount } from "../../internal/viem/signing.ts"
import * as AccountError from "../AccountError.ts"

/** The most passkeys `WebAuthnValidator` holds for one account. */
const MAX_PASSKEYS = 16

/**
 * An account's passkey owners: the passkeys installed on `WebAuthnValidator`, and how many must sign.
 *
 * @internal
 */
export interface Owners {
  readonly passkeys: ReadonlyArray<WebAuthnAccount>
  readonly threshold: number
}

/** A passkey owner option: one passkey, or several with how many must sign (`threshold`, 1 by default). */
export type Owner = WebAuthnAccount | {
  readonly passkeys: ReadonlyArray<WebAuthnAccount>
  readonly threshold?: number | undefined
}

/**
 * Whether an owner option is passkeys rather than a key or a JSON-RPC wallet.
 *
 * @internal
 */
export const isOwner = (owner: object): owner is Owner =>
  "passkeys" in owner || isWebAuthnAccount(owner as WebAuthnAccount)

/**
 * Checks a passkey owner option, as `owners` does.
 *
 * @internal
 */
export const fromOwner = (
  owner: Owner,
  account: AccountError.Options["account"]
): Effect.Effect<Owners, AccountError.AccountError> =>
  "passkeys" in owner ? owners(owner.passkeys, owner.threshold, account) : owners([owner], 1, account)

/**
 * The validator's address.
 *
 * @internal
 */
export const validator: Hex = WebAuthnValidator.addressV1

/**
 * Checks passkey owners the validator accepts: 1 to 16 distinct passkeys and a threshold between 1 and their count.
 *
 * @internal
 */
export const owners = (
  passkeys: ReadonlyArray<WebAuthnAccount>,
  threshold: number | undefined,
  account: AccountError.Options["account"]
): Effect.Effect<Owners, AccountError.AccountError> => {
  const ids = new Set(passkeys.map((passkey) => WebAuthn.credentialId(passkey.publicKey)))
  if (passkeys.length === 0 || passkeys.length > MAX_PASSKEYS || ids.size !== passkeys.length) {
    return Effect.fail(AccountError.invalidOptions({
      account,
      detail: `passkeys must be 1 to ${MAX_PASSKEYS} distinct passkeys, got ${passkeys.length}`
    }))
  }
  const required = threshold ?? 1
  if (!Number.isInteger(required) || required < 1 || required > passkeys.length) {
    return Effect.fail(AccountError.invalidOptions({
      account,
      detail: `threshold ${required} with ${passkeys.length} passkeys`
    }))
  }
  return Effect.succeed({ passkeys, threshold: required })
}

/**
 * What an account installs `WebAuthnValidator` with: the passkeys, each requiring User Verification, and the threshold.
 *
 * @internal
 */
export const installData = (owners: Owners): Hex =>
  WebAuthn.installData({
    threshold: owners.threshold,
    passkeys: owners.passkeys.map((passkey) => ({ publicKey: passkey.publicKey, requireUserVerification: true }))
  })

/**
 * How passkey owners sign for one account: which backend the validator verifies P-256 with, the stub for gas
 * estimation, and signing a user operation hash or an ERC-1271 hash.
 *
 * @internal
 */
export interface Signing {
  readonly precompile: boolean
  readonly credentialIds: ReadonlyArray<Hex>
  readonly stubSignature: Hex
  /** Prompts each signing passkey once for `challenge`. */
  readonly assert: (challenge: Hex) => Effect.Effect<ReadonlyArray<WebAuthn.Assertion>, AccountError.AccountError>
  readonly signUserOperationHash: (hash: Hex) => Effect.Effect<Hex, AccountError.AccountError>
  /** Signs `hash` bound to the account and chain, as the validator checks it for an outside caller. */
  readonly sign1271: (hash: Hex) => Effect.Effect<Hex, AccountError.AccountError>
}

/**
 * The signing side of passkey owners on `client`'s chain. The first `threshold` passkeys by credential id sign; the
 * validator verifies P-256 with the precompile where the chain has it.
 *
 * @internal
 */
export const signing = Effect.fnUntraced(function*(
  client: ChainClient,
  owners: Owners,
  account: AccountError.Options["account"] & { readonly address: Hex }
): Effect.fn.Return<Signing, ChainError.ChainError> {
  const precompile = yield* hasP256Precompile(client)
  const signers = owners.passkeys
    .map((passkey) => ({ id: WebAuthn.credentialId(passkey.publicKey), signer: passkeySigner(passkey, account) }))
    // Stryker disable next-line EqualityOperator: credential ids are distinct
    .sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1))
    .slice(0, owners.threshold)
  const assert = (challenge: Hex) => Effect.forEach(signers, ({ signer }) => signer.sign(challenge))
  const signUserOperationHash = (hash: Hex) =>
    assert(hash).pipe(Effect.map((assertions) => WebAuthn.encodeSignature({ precompile, assertions })))

  return {
    precompile,
    credentialIds: signers.map(({ id }) => id),
    stubSignature: WebAuthn.stubSignature({ precompile, credentialIds: signers.map(({ id }) => id) }),
    assert,
    signUserOperationHash,
    sign1271: (hash) =>
      signUserOperationHash(
        WebAuthn.replaySafeHash({ validator, chainId: client.chain.id, account: account.address, hash })
      )
  }
})

// The passkey signing of each account Namera built with passkey owners, for multichain signing.
const registry = new WeakMap<object, Signing>()

/**
 * Remembers an account's passkey signing, so `signUserOperations` can sign for it.
 *
 * @internal
 */
export const register = <A extends object>(account: A, signing: Signing): A => {
  registry.set(account, signing)
  return account
}

/**
 * The passkey signing of an account Namera built with passkey owners.
 *
 * @internal
 */
export const signingOf = (account: object): Signing | undefined => registry.get(account)
