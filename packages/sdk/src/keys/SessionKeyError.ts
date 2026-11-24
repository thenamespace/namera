/**
 * Failures describing a session key: an invalid signer address or passkey public key, no signers, more signers than
 * the validator's config holds, a repeated signer, or a threshold outside 1 to the number of signers.
 *
 * @stability experimental
 * @since 2.0.0
 */
import * as Predicate from "effect/Predicate"
import * as Schema from "effect/Schema"

import { TypeId as NameraErrorTypeId } from "../internal/nameraError.ts"
import { version } from "../internal/version.ts"
import type * as NameraError from "../NameraError.ts"

const TypeId = "~@namera-ai/sdk/keys/SessionKeyError" as const

const Address = Schema.TemplateLiteral(["0x", Schema.String])

/**
 * A signer is not a 20-byte hex address, or its checksum is wrong.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class InvalidAddress
  extends Schema.TaggedError<InvalidAddress>("@namera-ai/sdk/keys/SessionKeyError/InvalidAddress")("InvalidAddress", {
    value: Schema.String
  })
{
  override get message(): string {
    return `${this.value} is not an address`
  }

  /** What to do about it. */
  get hint(): string {
    return "Pass the agent's address: 0x followed by 40 hex characters, with a correct checksum if mixed-case."
  }
}

/**
 * A passkey's public key is not an uncompressed P-256 key: 64 bytes (x ‖ y), or 65 starting with `0x04`.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class InvalidPublicKey
  extends Schema.TaggedError<InvalidPublicKey>("@namera-ai/sdk/keys/SessionKeyError/InvalidPublicKey")(
    "InvalidPublicKey",
    { value: Schema.String }
  )
{
  override get message(): string {
    return `${this.value} is not a P-256 public key`
  }

  /** What to do about it. */
  get hint(): string {
    return "Pass the passkey's `publicKey`, as a viem WebAuthn account holds it."
  }
}

/**
 * The session key has no signers.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class NoSigners
  extends Schema.TaggedError<NoSigners>("@namera-ai/sdk/keys/SessionKeyError/NoSigners")("NoSigners", {})
{
  override get message(): string {
    return "The session key has no signers"
  }

  /** What to do about it. */
  get hint(): string {
    return "Pass at least one signer."
  }
}

/**
 * More signers than Smart Sessions keeps in a session validator's config (2,304 bytes): 69 ECDSA signers or 16
 * passkeys.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class TooManySigners
  extends Schema.TaggedError<TooManySigners>("@namera-ai/sdk/keys/SessionKeyError/TooManySigners")(
    "TooManySigners",
    { signers: Schema.Int, max: Schema.Int }
  )
{
  override get message(): string {
    return `The session key has ${this.signers} signers, over the ${this.max} its validator's config holds`
  }

  /** What to do about it. */
  get hint(): string {
    return `Use at most ${this.max} signers.`
  }
}

/**
 * A signer appears more than once.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class DuplicateSigner
  extends Schema.TaggedError<DuplicateSigner>("@namera-ai/sdk/keys/SessionKeyError/DuplicateSigner")(
    "DuplicateSigner",
    { signer: Address }
  )
{
  override get message(): string {
    return `${this.signer} is a signer more than once`
  }

  /** What to do about it. */
  get hint(): string {
    return "Remove the duplicate; each signer counts once toward the threshold."
  }
}

/**
 * The threshold is not a whole number from 1 to the number of signers.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class InvalidThreshold
  extends Schema.TaggedError<InvalidThreshold>("@namera-ai/sdk/keys/SessionKeyError/InvalidThreshold")(
    "InvalidThreshold",
    { threshold: Schema.Number, signers: Schema.Int }
  )
{
  override get message(): string {
    return `A threshold of ${this.threshold} with ${this.signers} signer${this.signers === 1 ? "" : "s"}`
  }

  /** What to do about it. */
  get hint(): string {
    return `Use a whole threshold from 1 to ${this.signers}.`
  }
}

/**
 * Schema for the reason of a `SessionKeyError`.
 *
 * @stability experimental
 * @category schemas
 * @since 2.0.0
 */
export const SessionKeyErrorReason: Schema.Union<
  [
    typeof InvalidAddress,
    typeof InvalidPublicKey,
    typeof NoSigners,
    typeof TooManySigners,
    typeof DuplicateSigner,
    typeof InvalidThreshold
  ]
> = Schema.Union([InvalidAddress, InvalidPublicKey, NoSigners, TooManySigners, DuplicateSigner, InvalidThreshold])

/**
 * The specific failure behind a `SessionKeyError`.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type SessionKeyErrorReason = typeof SessionKeyErrorReason.Type

/**
 * An invalid session key description. `reason` says what is wrong.
 *
 * **Example** (Narrowing on the reason)
 *
 * ```ts import.meta.vitest
 * import { SessionKey, SessionKeyError } from "@namera-ai/sdk"
 *
 * const caught = (): unknown => {
 *   try {
 *     return SessionKey.ecdsaThreshold({ threshold: 3, signers: ["0x0000000000000000000000000000000000000001"] })
 *   } catch (error) {
 *     return error
 *   }
 * }
 * const error = caught() as SessionKeyError.SessionKeyError
 *
 * SessionKeyError.isSessionKeyError(error) // => true
 * error.reason._tag // => "InvalidThreshold"
 * error.metaMessages // => ["Hint: Use a whole threshold from 1 to 1."]
 * ```
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class SessionKeyError extends Schema.TaggedError<SessionKeyError>("@namera-ai/sdk/keys/SessionKeyError")(
  "SessionKeyError",
  { reason: SessionKeyErrorReason }
) implements NameraError.Fields {
  readonly [TypeId] = TypeId
  readonly [NameraErrorTypeId] = NameraErrorTypeId

  override readonly cause = this.reason

  get shortMessage(): string {
    return this.reason.message
  }

  get details(): string | undefined {
    return undefined
  }

  get docsPath(): string | undefined {
    return undefined
  }

  get metaMessages(): ReadonlyArray<string> {
    return [`Hint: ${this.reason.hint}`]
  }

  get version(): string {
    return `@namera-ai/sdk@${version}`
  }

  override get message(): string {
    return this.shortMessage
  }
}

/**
 * Checks whether a value is a `SessionKeyError`, from any copy of the package.
 *
 * @stability experimental
 * @category guards
 * @since 2.0.0
 */
export const isSessionKeyError = (u: unknown): u is SessionKeyError => Predicate.hasProperty(u, TypeId)
