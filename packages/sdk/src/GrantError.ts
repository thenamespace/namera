/**
 * Failures reading or checking a grant: input that isn't a grant, a version this SDK doesn't read, an owner signature
 * that doesn't verify, a chain the grant doesn't cover, digests that don't match its session, or an agent signer that
 * isn't its session key.
 *
 * @stability experimental
 * @since 2.0.0
 */
import * as Predicate from "effect/Predicate"
import * as Schema from "effect/Schema"

import { version } from "./internal/version.ts"
import * as NameraError from "./NameraError.ts"

const TypeId = "~@namera-ai/sdk/GrantError" as const

const Chain = Schema.TemplateLiteral(["eip155:", Schema.Number])

/**
 * The input is not a grant: not JSON or a token, missing fields, or a session that doesn't match its id.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class Malformed extends Schema.TaggedError<Malformed>("@namera-ai/sdk/GrantError/Malformed")("Malformed", {
  detail: Schema.String
}) {
  override get message(): string {
    return `The input is not a grant: ${this.detail}`
  }

  /** What to do about it. */
  get hint(): string {
    return "Pass the grant as `Grant.serialize` wrote it: its JSON or its `nmr1_` token."
  }
}

/**
 * The grant is of a version this SDK doesn't read.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class VersionUnsupported
  extends Schema.TaggedError<VersionUnsupported>("@namera-ai/sdk/GrantError/VersionUnsupported")(
    "VersionUnsupported",
    { version: Schema.Unknown }
  )
{
  override get message(): string {
    return `Grant version ${String(this.version)} is not supported`
  }

  /** What to do about it. */
  get hint(): string {
    return "Upgrade @namera-ai/sdk; this version reads grants of version 1."
  }
}

/**
 * The owner's signature on a chain doesn't verify for the account (ERC-1271, or ERC-6492 while undeployed).
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class InvalidSignature
  extends Schema.TaggedError<InvalidSignature>("@namera-ai/sdk/GrantError/InvalidSignature")("InvalidSignature", {
    chain: Chain
  })
{
  override get message(): string {
    return `The owner's signature on ${this.chain} does not verify`
  }

  /** What to do about it. */
  get hint(): string {
    return "Sign the grant's typed data with the account itself (its owner through `account.signTypedData`)."
  }
}

/**
 * The grant doesn't cover the chain.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class ChainNotCovered
  extends Schema.TaggedError<ChainNotCovered>("@namera-ai/sdk/GrantError/ChainNotCovered")("ChainNotCovered", {
    chain: Chain
  })
{
  override get message(): string {
    return `The grant does not cover ${this.chain}`
  }

  /** What to do about it. */
  get hint(): string {
    return "Create the grant with an account on this chain too; one grant can cover several chains."
  }
}

/**
 * A chain's session digest differs from what the grant's session compiles to: the grant was altered.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class DigestMismatch
  extends Schema.TaggedError<DigestMismatch>("@namera-ai/sdk/GrantError/DigestMismatch")("DigestMismatch", {
    chain: Chain
  })
{
  override get message(): string {
    return `The grant's session digest on ${this.chain} does not match its session`
  }

  /** What to do about it. */
  get hint(): string {
    return "Don't edit a grant: create a new one with the changed session."
  }
}

/**
 * The signer given to `Grant.toAccount` isn't the grant's session key: an account or passkey the session doesn't name,
 * or fewer of them than its threshold.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class SignerMismatch
  extends Schema.TaggedError<SignerMismatch>("@namera-ai/sdk/GrantError/SignerMismatch")("SignerMismatch", {
    detail: Schema.String
  })
{
  override get message(): string {
    return `The signer is not the grant's session key: ${this.detail}`
  }

  /** What to do about it. */
  get hint(): string {
    return "Pass the session key the grant was made for (`grant.session.signer` names it), as many as its threshold."
  }
}

/**
 * Schema for the reason of a `GrantError`.
 *
 * @stability experimental
 * @category schemas
 * @since 2.0.0
 */
export const GrantErrorReason: Schema.Union<
  [
    typeof Malformed,
    typeof VersionUnsupported,
    typeof InvalidSignature,
    typeof ChainNotCovered,
    typeof DigestMismatch,
    typeof SignerMismatch
  ]
> = Schema.Union([Malformed, VersionUnsupported, InvalidSignature, ChainNotCovered, DigestMismatch, SignerMismatch])

/**
 * The specific failure behind a `GrantError`.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type GrantErrorReason = typeof GrantErrorReason.Type

/**
 * A grant that can't be read or doesn't check out. `reason` says what is wrong.
 *
 * **Example** (Parsing something that isn't a grant)
 *
 * ```ts import.meta.vitest
 * import { Grant, GrantError } from "@namera-ai/sdk"
 *
 * const caught = (): unknown => {
 *   try {
 *     return Grant.parse("not a grant")
 *   } catch (error) {
 *     return error
 *   }
 * }
 * const error = caught() as GrantError.GrantError
 *
 * GrantError.isGrantError(error) // => true
 * error.reason._tag // => "Malformed"
 * ```
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class GrantError extends Schema.TaggedError<GrantError>("@namera-ai/sdk/GrantError")("GrantError", {
  reason: GrantErrorReason
}) implements NameraError.Fields {
  readonly [TypeId] = TypeId
  readonly [NameraError.TypeId] = NameraError.TypeId

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
 * Checks whether a value is a `GrantError`, from any copy of the package.
 *
 * @stability experimental
 * @category guards
 * @since 2.0.0
 */
export const isGrantError = (u: unknown): u is GrantError => Predicate.hasProperty(u, TypeId)

/**
 * A `GrantError` for a reason.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const make = (reason: GrantErrorReason): GrantError => new GrantError({ reason })
