import * as AbiParameters from "ox/AbiParameters"
import * as Address from "ox/Address"
import * as Hex from "ox/Hex"

import * as WebAuthn from "./account/webauthn.ts"

/**
 * A session key as `ECDSASessionValidator` checks it: `threshold` of the `signers` sign, signers in ascending order.
 */
export interface EcdsaSessionKey {
  readonly type: "ecdsa"
  readonly threshold: number
  readonly signers: ReadonlyArray<Address.Address>
}

/**
 * A session key of passkeys, checked by `WebAuthnValidator` from the session's config (statelessly): `threshold` of
 * the `passkeys` sign, ordered by credential id.
 */
export interface PasskeySessionKey {
  readonly type: "passkey"
  readonly threshold: number
  readonly passkeys: ReadonlyArray<WebAuthn.Passkey>
}

/**
 * Why a session key is invalid.
 *
 * @internal
 */
export type Problem =
  | { readonly _tag: "InvalidAddress"; readonly value: string }
  | { readonly _tag: "NoSigners" }
  | { readonly _tag: "TooManySigners"; readonly signers: number; readonly max: number }
  | { readonly _tag: "InvalidPublicKey"; readonly value: string }
  | { readonly _tag: "DuplicateSigner"; readonly signer: Hex.Hex }
  | { readonly _tag: "InvalidThreshold"; readonly threshold: number; readonly signers: number }

// Smart Sessions keeps a session validator's config in at most 2,304 bytes: `abi.encode(threshold, signers)` is
// 96 + 32 bytes per ECDSA signer, and 96 + 128 per passkey (WebAuthnValidator also caps passkeys at 16).
const MAX_ECDSA_SIGNERS = 69
const MAX_PASSKEYS = 16

/**
 * Validates and normalises a k-of-n ECDSA session key: checksummed addresses, sorted ascending, no duplicates, at most
 * 69 signers, and a whole threshold from 1 to the number of signers.
 *
 * @internal
 */
export const ecdsa = (
  threshold: number,
  signers: ReadonlyArray<string>
): { readonly sessionKey: EcdsaSessionKey } | { readonly problem: Problem } => {
  if (signers.length === 0) return { problem: { _tag: "NoSigners" } }
  if (signers.length > MAX_ECDSA_SIGNERS) {
    return { problem: { _tag: "TooManySigners", signers: signers.length, max: MAX_ECDSA_SIGNERS } }
  }

  const checksummed: Array<Address.Address> = []
  for (const value of signers) {
    if (!Address.validate(value)) return { problem: { _tag: "InvalidAddress", value } }
    const signer = Address.checksum(value)
    if (checksummed.includes(signer)) return { problem: { _tag: "DuplicateSigner", signer } }
    checksummed.push(signer)
  }

  const invalid = thresholdProblem(threshold, checksummed.length)
  if (invalid !== undefined) return { problem: invalid }

  // Stryker disable next-line EqualityOperator: signers are distinct, so `<` and `<=` order them the same
  const sorted = [...checksummed].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1))
  return { sessionKey: { type: "ecdsa", threshold, signers: sorted } }
}

const thresholdProblem = (threshold: number, signers: number): Problem | undefined =>
  !Number.isInteger(threshold) || threshold < 1 || threshold > signers
    ? { _tag: "InvalidThreshold", threshold, signers }
    : undefined

// An uncompressed P-256 public key: 64 bytes (x ‖ y), or 65 with the 0x04 prefix.
const isPublicKey = (value: string): value is Hex.Hex =>
  Hex.validate(value) && (Hex.size(value) === 64 || (Hex.size(value) === 65 && value.slice(0, 4) === "0x04"))

/**
 * Validates and normalises a k-of-n passkey session key: well-formed P-256 public keys, no duplicates, at most 16,
 * ordered by credential id, and a whole threshold from 1 to the number of passkeys.
 *
 * @internal
 */
export const passkey = (
  threshold: number,
  passkeys: ReadonlyArray<{ readonly publicKey: string; readonly requireUserVerification?: boolean | undefined }>
): { readonly sessionKey: PasskeySessionKey } | { readonly problem: Problem } => {
  if (passkeys.length === 0) return { problem: { _tag: "NoSigners" } }
  if (passkeys.length > MAX_PASSKEYS) {
    return { problem: { _tag: "TooManySigners", signers: passkeys.length, max: MAX_PASSKEYS } }
  }

  const byId = new Map<Hex.Hex, WebAuthn.Passkey>()
  for (const { publicKey, requireUserVerification } of passkeys) {
    if (!isPublicKey(publicKey)) return { problem: { _tag: "InvalidPublicKey", value: publicKey } }
    const id = WebAuthn.credentialId(publicKey)
    if (byId.has(id)) return { problem: { _tag: "DuplicateSigner", signer: publicKey } }
    byId.set(id, {
      publicKey: publicKey.toLowerCase() as Hex.Hex,
      requireUserVerification: requireUserVerification ?? true
    })
  }

  const invalid = thresholdProblem(threshold, byId.size)
  if (invalid !== undefined) return { problem: invalid }

  // Stryker disable next-line EqualityOperator: credential ids are distinct, so `<` and `<=` order them the same
  const ids = [...byId.keys()].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1))
  return { sessionKey: { type: "passkey", threshold, passkeys: ids.map((id) => byId.get(id)!) } }
}

const configParameters = AbiParameters.from(["uint256 threshold", "address[] signers"])

/**
 * The config `ECDSASessionValidator` reads: `abi.encode(uint256 threshold, address[] signers)`.
 */
export const encodeConfig = (sessionKey: EcdsaSessionKey): `0x${string}` =>
  AbiParameters.encode(configParameters, [BigInt(sessionKey.threshold), sessionKey.signers])

/**
 * A session key's validator config, its `sessionValidatorInitData`: `ECDSASessionValidator`'s
 * `abi.encode(threshold, signers)`, or `WebAuthnValidator`'s `abi.encode(threshold, passkeys)`.
 *
 * @internal
 */
export const validatorData = (sessionKey: EcdsaSessionKey | PasskeySessionKey): Hex.Hex =>
  sessionKey.type === "ecdsa" ? encodeConfig(sessionKey) : WebAuthn.installData(sessionKey)
