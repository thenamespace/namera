/**
 * Operations and signatures a grant's session would refuse, caught before signing: a call nothing allows, an
 * argument a condition rejects, a spent budget, a signature no signing policy allows, or a session outside its
 * window, not enabled or revoked.
 *
 * @stability experimental
 * @since 2.0.0
 */
import * as Data from "effect/Data"
import * as Predicate from "effect/Predicate"

import type { Violation } from "./internal/core/evaluate/violation.ts"
import { TypeId as NameraErrorTypeId } from "./internal/nameraError.ts"
import { version } from "./internal/version.ts"
import type * as NameraError from "./NameraError.ts"

const TypeId = "~@namera-ai/sdk/PolicyViolationError" as const

const resets = (resetsAt: number | undefined) =>
  resetsAt === undefined ? "" : `, until ${new Date(resetsAt * 1000).toISOString()}`

/**
 * A call no policy of the session allows: no action for its target and function, and no `Policy.anyCall`, or a call
 * Smart Sessions never allows (a nested `execute` on the account, Smart Sessions itself).
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class CallNotAllowed extends Data.TaggedError("CallNotAllowed")<{
  readonly call: number
  readonly to: `0x${string}`
  readonly selector: `0x${string}`
}> {
  override get message(): string {
    return `Call ${this.call} (${this.selector} on ${this.to}) is not allowed by the session`
  }

  /** What to do about it. */
  get hint(): string {
    return "Ask the owner for a grant whose session has a policy for this call."
  }
}

/**
 * A call the session allows, with arguments or a value its conditions reject (`policy: "arguments"`), or an approval
 * of a spender or amount `Policy.approvals` doesn't allow (`policy: "approvals"`).
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class ArgumentRejected extends Data.TaggedError("ArgumentRejected")<{
  readonly call: number
  readonly to: `0x${string}`
  readonly selector: `0x${string}`
  readonly policy: "arguments" | "approvals"
}> {
  override get message(): string {
    return `Call ${this.call} (${this.selector} on ${this.to}) breaks the session's ${
      this.policy === "approvals" ? "approval limits" : "conditions on its arguments"
    }`
  }

  /** What to do about it. */
  get hint(): string {
    return "Change the call's arguments to what the session allows; `Grant.describe` lists its conditions."
  }
}

/**
 * The calls would spend more of a token than the session's budget has left this period.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class SpendLimitExceeded extends Data.TaggedError("SpendLimitExceeded")<{
  readonly token: `0x${string}`
  readonly attempted: bigint
  readonly remaining: bigint
  readonly resetsAt?: number
}> {
  override get message(): string {
    return `Spending ${this.attempted} of ${this.token} exceeds the ${this.remaining} left${resets(this.resetsAt)}`
  }

  /** What to do about it. */
  get hint(): string {
    return "Spend at most what is left, or wait for the budget to reset (`resetsAt`, in seconds)."
  }
}

/**
 * The calls would send more native currency than the session's budget has left this period.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class ValueLimitExceeded extends Data.TaggedError("ValueLimitExceeded")<{
  readonly attempted: bigint
  readonly remaining: bigint
  readonly resetsAt?: number
}> {
  override get message(): string {
    return `Sending ${this.attempted} wei exceeds the ${this.remaining} left${resets(this.resetsAt)}`
  }

  /** What to do about it. */
  get hint(): string {
    return "Send at most what is left, or wait for the budget to reset (`resetsAt`, in seconds)."
  }
}

/**
 * The session has sent as many operations as its rate limit allows this period.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class RateLimited
  extends Data.TaggedError("RateLimited")<{ readonly remaining: bigint; readonly resetsAt?: number }>
{
  override get message(): string {
    return `The session's rate limit allows no more operations${resets(this.resetsAt)}`
  }

  /** What to do about it. */
  get hint(): string {
    return "Wait for the rate limit to reset (`resetsAt`, in seconds), or batch calls into one operation."
  }
}

/**
 * The operation's worst-case gas cost exceeds what the session's gas budget has left this period.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class GasLimitExceeded extends Data.TaggedError("GasLimitExceeded")<{
  readonly attempted: bigint
  readonly remaining: bigint
  readonly resetsAt?: number
}> {
  override get message(): string {
    return `A worst-case gas cost of ${this.attempted} wei exceeds the ${this.remaining} left${resets(this.resetsAt)}`
  }

  /** What to do about it. */
  get hint(): string {
    return "Lower the operation's gas limits or fees, or wait for the budget to reset (`resetsAt`, in seconds)."
  }
}

/**
 * No signing policy of the session allows the signature.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class SignatureNotAllowed extends Data.TaggedError("SignatureNotAllowed")<{ readonly detail: string }> {
  override get message(): string {
    return `The session may not sign this: ${this.detail}`
  }

  /** What to do about it. */
  get hint(): string {
    return "Ask the owner for a grant with a `Policy.signTypedData` for this app's typed data."
  }
}

/**
 * The operation uses a paymaster, and the session doesn't allow one (`sponsored: false`).
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class PaymasterNotAllowed extends Data.TaggedError("PaymasterNotAllowed") {
  override get message(): string {
    return "The session does not allow a paymaster"
  }

  /** What to do about it. */
  get hint(): string {
    return "Send without a paymaster, or ask the owner for a session with `sponsored: true` and a limit policy."
  }
}

/**
 * The session's window has ended.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class SessionExpired extends Data.TaggedError("SessionExpired")<{ readonly validUntil: number }> {
  override get message(): string {
    return `The session expired at ${new Date(this.validUntil * 1000).toISOString()}`
  }

  /** What to do about it. */
  get hint(): string {
    return "Ask the owner for a new grant."
  }
}

/**
 * The session's window hasn't started.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class SessionNotYetValid extends Data.TaggedError("SessionNotYetValid")<{ readonly validAfter: number }> {
  override get message(): string {
    return `The session starts at ${new Date(this.validAfter * 1000).toISOString()}`
  }

  /** What to do about it. */
  get hint(): string {
    return "Wait until the session's `validAfter`."
  }
}

/**
 * The session isn't enabled on the chain yet, which signatures need (operations enable it themselves).
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class SessionNotEnabled extends Data.TaggedError("SessionNotEnabled") {
  override get message(): string {
    return "The session is not enabled on this chain yet"
  }

  /** What to do about it. */
  get hint(): string {
    return "Send the agent's first operation (it enables the session), or have the owner run `Grant.install`."
  }
}

/**
 * The session was removed, or its grant's enable signature was used up or revoked, so it can't be enabled again.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class SessionRevoked extends Data.TaggedError("SessionRevoked") {
  override get message(): string {
    return "The session was revoked"
  }

  /** What to do about it. */
  get hint(): string {
    return "Ask the owner for a new grant."
  }
}

/**
 * One reason the session would refuse.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type PolicyViolationReason =
  | CallNotAllowed
  | ArgumentRejected
  | SpendLimitExceeded
  | ValueLimitExceeded
  | RateLimited
  | GasLimitExceeded
  | SignatureNotAllowed
  | PaymasterNotAllowed
  | SessionExpired
  | SessionNotYetValid
  | SessionNotEnabled
  | SessionRevoked

/**
 * What the session would refuse, found before signing. `violations` lists every reason; `reason` is the first.
 *
 * **Example** (Reading the first reason)
 *
 * ```ts import.meta.vitest
 * import { PolicyViolationError } from "@namera-ai/sdk"
 *
 * const error = PolicyViolationError.make([{ _tag: "RateLimited", remaining: 0n, resetsAt: 1_800_000_000 }])
 * PolicyViolationError.isPolicyViolationError(error) // => true
 * error.reason._tag // => "RateLimited"
 * ```
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class PolicyViolationError extends Data.TaggedError("PolicyViolationError")<{
  readonly violations: readonly [PolicyViolationReason, ...Array<PolicyViolationReason>]
}> implements NameraError.Fields {
  readonly [TypeId] = TypeId
  readonly [NameraErrorTypeId] = NameraErrorTypeId

  /** The first reason. */
  get reason(): PolicyViolationReason {
    return this.violations[0]
  }

  override get cause(): PolicyViolationReason {
    return this.reason
  }

  get shortMessage(): string {
    const more = this.violations.length - 1
    return `${this.reason.message}${more === 0 ? "" : ` (and ${more} more)`}`
  }

  get details(): string | undefined {
    return undefined
  }

  get docsPath(): string | undefined {
    return undefined
  }

  get metaMessages(): ReadonlyArray<string> {
    return [...this.violations.slice(1).map((violation) => violation.message), `Hint: ${this.reason.hint}`]
  }

  get version(): string {
    return `@namera-ai/sdk@${version}`
  }

  override get message(): string {
    return this.shortMessage
  }
}

/**
 * Checks whether a value is a `PolicyViolationError`, from any copy of the package.
 *
 * @stability experimental
 * @category guards
 * @since 2.0.0
 */
export const isPolicyViolationError = (u: unknown): u is PolicyViolationError => Predicate.hasProperty(u, TypeId)

const reasonOf = (violation: Violation): PolicyViolationReason => {
  const { _tag, ...fields } = violation
  const defined = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as never
  switch (_tag) {
    case "CallNotAllowed":
      return new CallNotAllowed(defined)
    case "ArgumentRejected":
      return new ArgumentRejected(defined)
    case "SpendLimitExceeded":
      return new SpendLimitExceeded(defined)
    case "ValueLimitExceeded":
      return new ValueLimitExceeded(defined)
    case "RateLimited":
      return new RateLimited(defined)
    case "GasLimitExceeded":
      return new GasLimitExceeded(defined)
    case "SignatureNotAllowed":
      return new SignatureNotAllowed(defined)
    case "PaymasterNotAllowed":
      return new PaymasterNotAllowed()
    case "SessionExpired":
      return new SessionExpired(defined)
    case "SessionNotYetValid":
      return new SessionNotYetValid(defined)
    case "SessionNotEnabled":
      return new SessionNotEnabled()
    case "SessionRevoked":
      return new SessionRevoked()
  }
}

/**
 * A reason from its plain description (`_tag` and fields).
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const toReason: (violation: Violation) => PolicyViolationReason = reasonOf

/**
 * A `PolicyViolationError` for one or more violations, given as reasons or their plain descriptions.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const make = (
  violations: readonly [Violation | PolicyViolationReason, ...Array<Violation | PolicyViolationReason>]
): PolicyViolationError =>
  new PolicyViolationError({
    violations: violations.map((violation) =>
      violation instanceof Error ? violation as PolicyViolationReason : reasonOf(violation as Violation)
    ) as [PolicyViolationReason, ...Array<PolicyViolationReason>]
  })
