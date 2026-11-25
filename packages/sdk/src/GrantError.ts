/**
 * Failures reading or checking a grant: input that isn't a grant, a version this SDK doesn't read, an owner signature
 * that doesn't verify, a chain the grant doesn't cover, digests that don't match its session, an agent signer that
 * isn't its session key, or a policy to remove that the session doesn't have (or whose removal would widen it).
 *
 * @stability experimental
 * @since 2.0.0
 */
import * as Data from "effect/Data"
import * as Predicate from "effect/Predicate"

import { TypeId as NameraErrorTypeId } from "./internal/nameraError.ts"
import { version } from "./internal/version.ts"
import type * as NameraError from "./NameraError.ts"

const TypeId = "~@namera-ai/sdk/GrantError" as const

/**
 * The input is not a grant: not JSON or a token, missing fields, or a session that doesn't match its id.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class Malformed extends Data.TaggedError("Malformed")<{ readonly detail: string }> {
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
export class VersionUnsupported extends Data.TaggedError("VersionUnsupported")<{ readonly version: unknown }> {
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
export class InvalidSignature extends Data.TaggedError("InvalidSignature")<{ readonly chain: `eip155:${number}` }> {
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
export class ChainNotCovered extends Data.TaggedError("ChainNotCovered")<{ readonly chain: `eip155:${number}` }> {
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
export class DigestMismatch extends Data.TaggedError("DigestMismatch")<{ readonly chain: `eip155:${number}` }> {
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
export class SignerMismatch extends Data.TaggedError("SignerMismatch")<{ readonly detail: string }> {
  override get message(): string {
    return `The signer is not the grant's session key: ${this.detail}`
  }

  /** What to do about it. */
  get hint(): string {
    return "Pass the session key the grant was made for (`grant.session.signer` names it), as many as its threshold."
  }
}

/**
 * A policy to remove from a grant's session isn't one of its policies.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class PolicyNotFound extends Data.TaggedError("PolicyNotFound")<{ readonly index: number }> {
  override get message(): string {
    return `Policy ${this.index} to remove is not one of the session's policies`
  }

  /** What to do about it. */
  get hint(): string {
    return "Pass the policy as the session has it: one of `grant.session.policies`."
  }
}

/**
 * Removing a call policy from a session that keeps `Policy.anyCall` would widen it: the call would then go through
 * `anyCall`, without the removed policy's conditions.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class RemovalWidens extends Data.TaggedError("RemovalWidens")<{ readonly index: number }> {
  override get message(): string {
    return `Removing policy ${this.index} would let its calls through Policy.anyCall without its conditions`
  }

  /** What to do about it. */
  get hint(): string {
    return "Remove Policy.anyCall in the same update, or narrow the policy's conditions instead of removing it."
  }
}

/**
 * The specific failure behind a `GrantError`.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type GrantErrorReason =
  | Malformed
  | VersionUnsupported
  | InvalidSignature
  | ChainNotCovered
  | DigestMismatch
  | SignerMismatch
  | PolicyNotFound
  | RemovalWidens

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
export class GrantError extends Data.TaggedError("GrantError")<{
  readonly reason: GrantErrorReason
}> implements NameraError.Fields {
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
