/**
 * Failures combining an account, a bundler and a paymaster that can't work together, refused before anything is
 * signed.
 *
 * @stability experimental
 * @since 2.0.0
 */
import * as Predicate from "effect/Predicate"
import * as Schema from "effect/Schema"

import { TypeId as NameraErrorTypeId } from "../internal/nameraError.ts"
import { version } from "../internal/version.ts"
import type * as NameraError from "../NameraError.ts"

const TypeId = "~@namera-ai/sdk/CompatError" as const

/**
 * One problem with a combination: a stable `code` and a sentence saying what is wrong and what to do.
 *
 * **Details**
 *
 * The codes are `PAYMASTER_BUNDLER_BOUND`, `PAYMASTER_AGENT_UNSUPPORTED`, `SPONSORSHIP_BUNDLER_BOUND`, `EIP7702_UNSUPPORTED`, `SLOW_INCLUSION`,
 * `SESSION_PERMIT_REQUIRED` and `NOT_ON_CHAIN`; `Compat.matrix()` lists the rule behind each.
 *
 * @stability experimental
 * @category schemas
 * @since 2.0.0
 */
export const Problem: Schema.Struct<{
  readonly code: Schema.Literals<
    readonly [
      "PAYMASTER_BUNDLER_BOUND",
      "PAYMASTER_AGENT_UNSUPPORTED",
      "SPONSORSHIP_BUNDLER_BOUND",
      "EIP7702_UNSUPPORTED",
      "SLOW_INCLUSION",
      "SESSION_PERMIT_REQUIRED",
      "NOT_ON_CHAIN"
    ]
  >
  readonly message: Schema.String
}> = Schema.Struct({
  code: Schema.Literals([
    "PAYMASTER_BUNDLER_BOUND",
    "PAYMASTER_AGENT_UNSUPPORTED",
    "SPONSORSHIP_BUNDLER_BOUND",
    "EIP7702_UNSUPPORTED",
    "SLOW_INCLUSION",
    "SESSION_PERMIT_REQUIRED",
    "NOT_ON_CHAIN"
  ]),
  message: Schema.String
})

/**
 * One problem with a combination.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Problem = typeof Problem.Type

/**
 * The account, bundler and paymaster can't work together on the chain. `problems` lists every reason.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class Incompatible extends Schema.TaggedError<Incompatible>("@namera-ai/sdk/CompatError/Incompatible")(
  "Incompatible",
  { problems: Schema.Array(Problem) }
) {
  override get message(): string {
    const [first, ...rest] = this.problems
    if (first === undefined) return "The combination is not supported"
    return `${first.code}: ${first.message}${rest.length === 0 ? "" : ` (and ${rest.length} more)`}`
  }

  /** What to do about it. */
  get hint(): string {
    return "Change the bundler or paymaster as each problem says, or pass `strict: false` to the bundler helper to send anyway."
  }
}

/**
 * Schema for the reason of a `CompatError`.
 *
 * @stability experimental
 * @category schemas
 * @since 2.0.0
 */
export const CompatErrorReason: typeof Incompatible = Incompatible

/**
 * The specific failure behind a `CompatError`.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type CompatErrorReason = Incompatible

/**
 * A combination of account, bundler and paymaster that can't work, refused before signing. `reason.problems` lists
 * what is wrong, with the codes `Compat.check` reports.
 *
 * **Example** (Reading the problems)
 *
 * ```ts import.meta.vitest
 * import { CompatError } from "@namera-ai/sdk"
 *
 * const error = CompatError.incompatible([{ code: "PAYMASTER_BUNDLER_BOUND", message: "use Pimlico's bundler" }])
 *
 * CompatError.isCompatError(error) // => true
 * error.reason.problems[0]?.code // => "PAYMASTER_BUNDLER_BOUND"
 * ```
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class CompatError extends Schema.TaggedError<CompatError>("@namera-ai/sdk/CompatError")("CompatError", {
  reason: Incompatible
}) implements NameraError.Fields {
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
 * Checks whether a value is a `CompatError`, from any copy of the package.
 *
 * @stability experimental
 * @category guards
 * @since 2.0.0
 */
export const isCompatError = (u: unknown): u is CompatError => Predicate.hasProperty(u, TypeId)

/**
 * A `CompatError` for a list of problems.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const incompatible = (problems: ReadonlyArray<Problem>): CompatError =>
  new CompatError({ reason: new Incompatible({ problems: [...problems] }) })
