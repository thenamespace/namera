/**
 * Failures from a paymaster: it rejected the user operation, its sponsorship policy isn't active, it (or the account
 * paying it in tokens) lacks funds, or it only accepts operations from other bundlers.
 *
 * @stability experimental
 * @since 2.0.0
 */
import * as Predicate from "effect/Predicate"
import * as Schema from "effect/Schema"

import { TypeId as NameraErrorTypeId } from "../internal/nameraError.ts"
import { redactUrl } from "../internal/redact.ts"
import { version } from "../internal/version.ts"
import type * as NameraError from "../NameraError.ts"

const TypeId = "~@namera-ai/sdk/PaymasterError" as const

const detail = Schema.optionalKey(Schema.String)

const withDetail = (summary: string, detail: string | undefined) =>
  detail === undefined ? summary : `${summary}: ${detail}`

/**
 * The paymaster refused the user operation for a reason Namera has no specific case for. `message` is the
 * paymaster's own message.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class Rejected extends Schema.TaggedError<Rejected>("@namera-ai/sdk/PaymasterError/Rejected")("Rejected", {
  vendor: Schema.String,
  message: Schema.String
}) {
  /** What to do about it. */
  get hint(): string {
    return "Read the paymaster's message; check the policy and context in the vendor's dashboard."
  }
}

/**
 * The sponsorship policy isn't active, or doesn't cover this chain.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class PolicyInactive
  extends Schema.TaggedError<PolicyInactive>("@namera-ai/sdk/PaymasterError/PolicyInactive")("PolicyInactive", {
    detail
  })
{
  override get message(): string {
    return withDetail("The paymaster's sponsorship policy is not active", this.detail)
  }

  /** What to do about it. */
  get hint(): string {
    return "Activate the policy in the vendor's dashboard, and enable it for this chain."
  }
}

/**
 * The sponsor's balance (the policy's billing account, or the paymaster's deposit) or the account's token balance
 * can't cover the operation.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class InsufficientBalance extends Schema.TaggedError<InsufficientBalance>(
  "@namera-ai/sdk/PaymasterError/InsufficientBalance"
)("InsufficientBalance", { detail }) {
  override get message(): string {
    return withDetail("The paymaster's sponsor or the paying account has too little balance", this.detail)
  }

  /** What to do about it. */
  get hint(): string {
    return "Fund the policy's billing account in the vendor's dashboard, or the account's token balance for a token paymaster."
  }
}

/**
 * The paymaster only accepts user operations bundled by certain bundlers (Pimlico's singleton paymaster, behind
 * Pimlico's and ZeroDev's sponsorship and Pimlico's ERC-20 paymaster, reverts `BundlerNotAllowed`). `bundler` is
 * the address it refused, when the revert named it.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class BundlerBound
  extends Schema.TaggedError<BundlerBound>("@namera-ai/sdk/PaymasterError/BundlerBound")("BundlerBound", {
    bundler: Schema.optionalKey(Schema.TemplateLiteral(["0x", Schema.String])),
    detail
  })
{
  override get message(): string {
    return withDetail("The paymaster does not accept operations from this bundler", this.detail)
  }

  /** What to do about it. */
  get hint(): string {
    return "Send through Pimlico's or ZeroDev's bundler, or use a paymaster that works with any bundler (Circle, Alchemy Gas Manager, Etherspot Arka, Candide)."
  }
}

/**
 * Schema for the reason of a `PaymasterError`.
 *
 * @stability experimental
 * @category schemas
 * @since 2.0.0
 */
export const PaymasterErrorReason: Schema.Union<
  [typeof Rejected, typeof PolicyInactive, typeof InsufficientBalance, typeof BundlerBound]
> = Schema.Union([Rejected, PolicyInactive, InsufficientBalance, BundlerBound])

/**
 * The specific failure behind a `PaymasterError`.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type PaymasterErrorReason = typeof PaymasterErrorReason.Type

/**
 * A failure from a paymaster. `reason` says which; `vendor` and `url` say where, when known. `url` never includes
 * credentials.
 *
 * **Example** (Narrowing on the reason)
 *
 * ```ts import.meta.vitest
 * import { PaymasterError } from "@namera-ai/sdk"
 *
 * const error = PaymasterError.policyInactive({ vendor: "pimlico", detail: "sponsorshipPolicy not active" })
 *
 * error instanceof PaymasterError.PaymasterError && error.reason._tag === "PolicyInactive" // => true
 * error.shortMessage // => "The paymaster's sponsorship policy is not active: sponsorshipPolicy not active"
 * ```
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class PaymasterError
  extends Schema.TaggedError<PaymasterError>("@namera-ai/sdk/PaymasterError")("PaymasterError", {
    vendor: Schema.optionalKey(Schema.String),
    url: Schema.optionalKey(Schema.String),
    reason: PaymasterErrorReason
  })
  implements NameraError.Fields
{
  readonly [TypeId] = TypeId
  readonly [NameraErrorTypeId] = NameraErrorTypeId

  override readonly cause = this.reason

  get shortMessage(): string {
    const { reason } = this
    return reason._tag === "Rejected"
      ? `The ${reason.vendor} paymaster rejected the user operation: ${reason.message}`
      : reason.message
  }

  get details(): string | undefined {
    return this.reason._tag === "Rejected" ? this.reason.message : this.reason.detail
  }

  get docsPath(): string | undefined {
    return undefined
  }

  get metaMessages(): ReadonlyArray<string> {
    return [
      ...(this.vendor === undefined ? [] : [`Paymaster: ${this.vendor}`]),
      ...(this.url === undefined ? [] : [`URL: ${this.url}`]),
      `Hint: ${this.reason.hint}`
    ]
  }

  get version(): string {
    return `@namera-ai/sdk@${version}`
  }

  override get message(): string {
    return this.shortMessage
  }
}

/**
 * Checks whether a value is a `PaymasterError`, from any copy of the package.
 *
 * @stability experimental
 * @category guards
 * @since 2.0.0
 */
export const isPaymasterError = (u: unknown): u is PaymasterError => Predicate.hasProperty(u, TypeId)

/**
 * The options every `PaymasterError` constructor accepts: the paymaster's vendor and endpoint (stored without
 * credentials), and a detail for the message (the paymaster's own words).
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export interface Options {
  readonly vendor?: string | undefined
  readonly url?: string | undefined
  readonly detail?: string | undefined
}

const make = (reason: PaymasterErrorReason, { url, vendor }: Options) =>
  new PaymasterError({
    reason,
    ...(vendor === undefined ? {} : { vendor }),
    ...(url === undefined ? {} : { url: redactUrl(url) })
  })

const detailOf = ({ detail }: Options) => (detail === undefined ? {} : { detail })

/**
 * Creates a `PaymasterError` for a paymaster's refusal, with its message.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const rejected = (
  options: Omit<Options, "detail" | "vendor"> & { readonly vendor: string; readonly message: string }
): PaymasterError => make(new Rejected({ vendor: options.vendor, message: options.message }), options)

/**
 * Creates a `PaymasterError` for an inactive sponsorship policy.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const policyInactive = (options: Options = {}): PaymasterError =>
  make(new PolicyInactive(detailOf(options)), options)

/**
 * Creates a `PaymasterError` for a balance too low to pay for the operation.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const insufficientBalance = (options: Options = {}): PaymasterError =>
  make(new InsufficientBalance(detailOf(options)), options)

/**
 * Creates a `PaymasterError` for a paymaster that refuses the bundler. `bundler` is the refused address, when known.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const bundlerBound = (
  options: Options & { readonly bundler?: `0x${string}` | undefined } = {}
): PaymasterError =>
  make(
    new BundlerBound({ ...detailOf(options), ...(options.bundler === undefined ? {} : { bundler: options.bundler }) }),
    options
  )
