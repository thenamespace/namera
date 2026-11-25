/**
 * Failures describing a session: the problems `Session.from` found in its input, or `Session.validate`'s errors when
 * a session is refused.
 *
 * @stability experimental
 * @since 2.0.0
 */
import * as Data from "effect/Data"
import * as Predicate from "effect/Predicate"

import type { ProblemCode } from "./internal/core/session/problem.ts"
import { TypeId as NameraErrorTypeId } from "./internal/nameraError.ts"
import { version } from "./internal/version.ts"
import type * as NameraError from "./NameraError.ts"

const TypeId = "~@namera-ai/sdk/SessionError" as const

/**
 * One problem with a session: a stable `code`, a sentence saying what is wrong, and the index of the policy it is
 * about, if any.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export interface Problem {
  readonly code: ProblemCode
  readonly message: string
  readonly policy?: number
}

/**
 * The session can't be built or used as described. `problems` lists everything wrong at once.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class InvalidSession extends Data.TaggedError("InvalidSession")<{ readonly problems: ReadonlyArray<Problem> }> {
  override get message(): string {
    const [first, ...rest] = this.problems
    if (first === undefined) return "The session is invalid"
    const where = first.policy === undefined ? "" : ` (policy ${first.policy})`
    return `${first.code}${where}: ${first.message}${rest.length === 0 ? "" : ` (and ${rest.length} more)`}`
  }

  /** What to do about it. */
  get hint(): string {
    return "Fix each listed problem; `Session.validate` reports them all with stable codes."
  }
}

/**
 * The class of a `SessionError`'s reason.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export const SessionErrorReason: typeof InvalidSession = InvalidSession

/**
 * The specific failure behind a `SessionError`.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type SessionErrorReason = InvalidSession

/**
 * A session that can't be built or used. `reason` says what is wrong.
 *
 * **Example** (Reading the problems)
 *
 * ```ts import.meta.vitest
 * import { Policy, Session, SessionError, SessionKey } from "@namera-ai/sdk"
 *
 * const caught = (): unknown => {
 *   try {
 *     return Session.from({
 *       signer: SessionKey.ecdsa("0x70997970C51812dc3A010C7d01b50e0d17dc79C8"),
 *       validUntil: "never",
 *       policies: [Policy.nativeTransfer({ to: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65" })]
 *     })
 *   } catch (error) {
 *     return error
 *   }
 * }
 * const error = caught() as SessionError.SessionError
 *
 * SessionError.isSessionError(error) // => true
 * error.reason.problems[0]?.code // => "UNSAFE_REQUIRED"
 * ```
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class SessionError extends Data.TaggedError("SessionError")<{
  readonly reason: InvalidSession
}> implements NameraError.Fields {
  readonly [TypeId] = TypeId
  readonly [NameraErrorTypeId] = NameraErrorTypeId

  override readonly cause = this.reason

  get shortMessage(): string {
    return this.reason.message
  }

  get details(): string | undefined {
    return this.reason.problems.length <= 1
      ? undefined
      : this.reason.problems.map((entry) => `${entry.code}: ${entry.message}`).join("\n")
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
 * Checks whether a value is a `SessionError`, from any copy of the package.
 *
 * @stability experimental
 * @category guards
 * @since 2.0.0
 */
export const isSessionError = (u: unknown): u is SessionError => Predicate.hasProperty(u, TypeId)

/**
 * A `SessionError` for a list of problems.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const invalidSession = (problems: ReadonlyArray<Problem>): SessionError =>
  new SessionError({ reason: new InvalidSession({ problems: [...problems] }) })
