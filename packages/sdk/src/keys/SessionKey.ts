/**
 * Session keys: the agent's signer as a session sees it. The agent generates its key; only the address goes to the
 * owner, who puts it in the session.
 *
 * **Details**
 *
 * A session key is checked on chain by `ECDSASessionValidator`: one key (`ecdsa`) or `threshold` of several
 * (`ecdsaThreshold`) sign each user operation, bound to the session's permission id. The key itself is any viem account the agent controls, such as a
 * `Keystore` key through `Keystore.toAccount`. A passkey session key (`passkey`, `passkeyThreshold`) is checked by
 * `WebAuthnValidator` from the session's own config, so the passkey needs no installation on the account.
 *
 * @stability experimental
 * @since 2.0.0
 */
import * as Predicate from "effect/Predicate"
import * as Result from "effect/Result"

import { type EcdsaSessionKey, type PasskeySessionKey, validatorData } from "../internal/core/sessionKey.ts"
import * as internal from "./internal/sessionKey.ts"
import type * as SessionKeyError from "./SessionKeyError.ts"

/**
 * A session key: `threshold` of its secp256k1 `signers` (checksummed, ascending), or of its `passkeys` (ordered by
 * credential id), sign the session's user operations.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type SessionKey = Ecdsa | Passkey

/**
 * A session key of secp256k1 keys, checked by `ECDSASessionValidator`.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Ecdsa = EcdsaSessionKey

/**
 * A session key of passkeys, checked by `WebAuthnValidator` from the session's config.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Passkey = PasskeySessionKey

/**
 * Checks whether a value is a `SessionKey`.
 *
 * @stability experimental
 * @category guards
 * @since 2.0.0
 */
export const isSessionKey = (u: unknown): u is SessionKey =>
  Predicate.hasProperty(u, "type") && Predicate.hasProperty(u, "threshold") && Predicate.isNumber(u.threshold)
  && ((u.type === "ecdsa" && Predicate.hasProperty(u, "signers") && Array.isArray(u.signers))
    || (u.type === "passkey" && Predicate.hasProperty(u, "passkeys") && Array.isArray(u.passkeys)))

/**
 * Returns what the session key's validator reads, a session's `sessionValidatorInitData` in Smart Sessions:
 * `ECDSASessionValidator`'s `abi.encode(uint256 threshold, address[] signers)`, or `WebAuthnValidator`'s
 * `abi.encode(uint256 threshold, (bytes32 x, bytes32 y, bool requireUserVerification, bytes32 rpIdHash)[])`.
 *
 * **When to use**
 *
 * Use when building Smart Sessions' session struct yourself; `Session` does it for you.
 *
 * @stability experimental
 * @category conversions
 * @since 2.0.0
 */
export const toValidatorData: (sessionKey: SessionKey) => `0x${string}` = validatorData

/**
 * A session key of one secp256k1 key: the agent's address.
 *
 * **Gotchas**
 *
 * Throws `SessionKeyError` (`InvalidAddress`) for a value that is not an address.
 *
 * **Example** (The agent's key as a session key)
 *
 * ```ts import.meta.vitest
 * import { SessionKey } from "@namera-ai/sdk"
 *
 * const sessionKey = SessionKey.ecdsa("0x70997970c51812dc3a010c7d01b50e0d17dc79c8")
 *
 * sessionKey.signers // => ["0x70997970C51812dc3A010C7d01b50e0d17dc79C8"]
 * sessionKey.threshold // => 1
 * ```
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export function ecdsa(address: string): Ecdsa {
  return Result.getOrThrow(internal.ecdsaThreshold({ threshold: 1, signers: [address] }))
}

/**
 * Types of `SessionKey.ecdsa`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace ecdsa {
  /**
   * The errors `SessionKey.ecdsa` can throw.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = SessionKeyError.SessionKeyError
}

/**
 * A session key of several secp256k1 keys, `threshold` of which must sign. The signers are sorted for you.
 *
 * **When to use**
 *
 * Use to split an agent's authority over several keys, such as two of three agent processes.
 *
 * **Gotchas**
 *
 * Throws `SessionKeyError`: `NoSigners`, `TooManySigners` over 69 signers (what a validator's config holds),
 * `InvalidAddress`, `DuplicateSigner`, or `InvalidThreshold` for a threshold outside 1 to the number of signers.
 *
 * **Example** (Two of three agent keys)
 *
 * ```ts import.meta.vitest
 * import { SessionKey } from "@namera-ai/sdk"
 *
 * const sessionKey = SessionKey.ecdsaThreshold({
 *   threshold: 2,
 *   signers: [
 *     "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
 *     "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
 *     "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"
 *   ]
 * })
 *
 * sessionKey.signers[0] // => "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"
 * ```
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export function ecdsaThreshold(options: ecdsaThreshold.Options): Ecdsa {
  return Result.getOrThrow(internal.ecdsaThreshold(options))
}

/**
 * Types of `SessionKey.ecdsaThreshold`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace ecdsaThreshold {
  /**
   * How many signers must sign, and the signers' addresses.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options {
    readonly threshold: number
    readonly signers: ReadonlyArray<string>
  }
  /**
   * The errors `SessionKey.ecdsaThreshold` can throw.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = SessionKeyError.SessionKeyError
}

/**
 * A session key of one passkey: its P-256 public key, such as a viem WebAuthn account's `publicKey`.
 *
 * **Details**
 *
 * The passkey must assert user verification unless `requireUserVerification` is `false`. `WebAuthnValidator`
 * checks the passkey from the session's config, so nothing is installed on the account.
 *
 * **Gotchas**
 *
 * Throws `SessionKeyError` (`InvalidPublicKey`) for a key that is not an uncompressed P-256 public key.
 *
 * **Example** (A passkey as a session key)
 *
 * ```ts import.meta.vitest
 * import { SessionKey } from "@namera-ai/sdk"
 *
 * const sessionKey = SessionKey.passkey({
 *   publicKey:
 *     "0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2964fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5"
 * })
 *
 * sessionKey.type // => "passkey"
 * sessionKey.passkeys[0]?.requireUserVerification // => true
 * ```
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export function passkey(passkey: passkey.Passkey): Passkey {
  return Result.getOrThrow(internal.passkeyThreshold({ threshold: 1, passkeys: [passkey] }))
}

/**
 * Types of `SessionKey.passkey`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace passkey {
  /**
   * A passkey's public key, and whether its assertions must carry user verification (default `true`).
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Passkey {
    readonly publicKey: string
    readonly requireUserVerification?: boolean | undefined
  }
  /**
   * The errors `SessionKey.passkey` can throw.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = SessionKeyError.SessionKeyError
}

/**
 * A session key of several passkeys, `threshold` of which must sign.
 *
 * **Gotchas**
 *
 * Throws `SessionKeyError`: `NoSigners`, `TooManySigners` over 16 passkeys, `InvalidPublicKey`, `DuplicateSigner`,
 * or `InvalidThreshold` for a threshold outside 1 to the number of passkeys.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export function passkeyThreshold(options: passkeyThreshold.Options): Passkey {
  return Result.getOrThrow(internal.passkeyThreshold(options))
}

/**
 * Types of `SessionKey.passkeyThreshold`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace passkeyThreshold {
  /**
   * How many passkeys must sign, and the passkeys.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options {
    readonly threshold: number
    readonly passkeys: ReadonlyArray<passkey.Passkey>
  }
  /**
   * The errors `SessionKey.passkeyThreshold` can throw.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = SessionKeyError.SessionKeyError
}
