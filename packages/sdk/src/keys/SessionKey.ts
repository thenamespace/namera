/**
 * Session keys: the agent's signer as a session sees it. The agent generates its key; only the address goes to the
 * owner, who puts it in the session.
 *
 * **Details**
 *
 * A session key is checked on chain by `ECDSASessionValidator`: one key (`ecdsa`) or `threshold` of several
 * (`ecdsaThreshold`) sign each user operation. The key itself is any viem account the agent controls, such as a
 * `Keystore` key through `Keystore.toAccount`.
 *
 * @stability experimental
 * @since 2.0.0
 */
import * as Predicate from "effect/Predicate"
import * as Result from "effect/Result"

import { type EcdsaSessionKey, encodeConfig } from "../internal/core/sessionKey.ts"
import * as internal from "./internal/sessionKey.ts"
import type * as SessionKeyError from "./SessionKeyError.ts"

/**
 * A session key: `threshold` of the `signers` (checksummed, ascending) sign the session's user operations.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type SessionKey = EcdsaSessionKey

/**
 * Checks whether a value is a `SessionKey`.
 *
 * @stability experimental
 * @category guards
 * @since 2.0.0
 */
export const isSessionKey = (u: unknown): u is SessionKey =>
  Predicate.hasProperty(u, "type") && u.type === "ecdsa"
  && Predicate.hasProperty(u, "threshold") && Predicate.isNumber(u.threshold)
  && Predicate.hasProperty(u, "signers") && Array.isArray(u.signers)

/**
 * Returns what `ECDSASessionValidator` reads for the session key, `abi.encode(uint256 threshold, address[] signers)`:
 * a session's `sessionValidatorInitData` in Smart Sessions.
 *
 * **When to use**
 *
 * Use when building Smart Sessions' session struct yourself; `Session` does it for you.
 *
 * @stability experimental
 * @category conversions
 * @since 2.0.0
 */
export const toValidatorData: (sessionKey: SessionKey) => `0x${string}` = encodeConfig

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
export function ecdsa(address: string): SessionKey {
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
 * Throws `SessionKeyError`: `NoSigners`, `InvalidAddress`, `DuplicateSigner`, or `InvalidThreshold` for a threshold
 * outside 1 to the number of signers.
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
export function ecdsaThreshold(options: ecdsaThreshold.Options): SessionKey {
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
