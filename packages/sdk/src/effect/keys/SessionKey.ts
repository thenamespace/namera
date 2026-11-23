/**
 * The Effect form of `SessionKey`: the agent's signer as a session sees it, failing in the error channel.
 *
 * @stability experimental
 * @since 2.0.0
 */
import * as Effect from "effect/Effect"

import * as internal from "../../keys/internal/sessionKey.ts"
import * as SessionKey_ from "../../keys/SessionKey.ts"
import type * as SessionKeyError from "../../keys/SessionKeyError.ts"

/**
 * A session key: `threshold` of the `signers` sign the session's user operations.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type SessionKey = SessionKey_.SessionKey

/**
 * Checks whether a value is a `SessionKey`.
 *
 * @stability experimental
 * @category guards
 * @since 2.0.0
 */
export const isSessionKey: (u: unknown) => u is SessionKey = SessionKey_.isSessionKey

/**
 * Returns what `ECDSASessionValidator` reads for the session key: a session's `sessionValidatorInitData`.
 *
 * @stability experimental
 * @category conversions
 * @since 2.0.0
 */
export const toValidatorData: (sessionKey: SessionKey) => `0x${string}` = SessionKey_.toValidatorData

/**
 * A session key of one secp256k1 key: the agent's address.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const ecdsa = (address: string): Effect.Effect<SessionKey, SessionKeyError.SessionKeyError> =>
  Effect.fromResult(internal.ecdsaThreshold({ threshold: 1, signers: [address] }))

/**
 * A session key of several secp256k1 keys, `threshold` of which must sign.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const ecdsaThreshold = (
  options: SessionKey_.ecdsaThreshold.Options
): Effect.Effect<SessionKey, SessionKeyError.SessionKeyError> => Effect.fromResult(internal.ecdsaThreshold(options))
