/**
 * Failures from a bundler: it rejected the user operation (an EntryPoint `AAxx` code, decoded revert data), it
 * doesn't support a method, or it dropped the operation before including it.
 *
 * @stability experimental
 * @since 2.0.0
 */
import * as Data from "effect/Data"
import * as Predicate from "effect/Predicate"

import { TypeId as NameraErrorTypeId } from "../internal/nameraError.ts"
import { redactUrl } from "../internal/redact.ts"
import { version } from "../internal/version.ts"
import type * as NameraError from "../NameraError.ts"

const TypeId = "~@namera-ai/sdk/BundlerError" as const

const withDetail = (summary: string, detail: string | undefined) =>
  detail === undefined ? summary : `${summary}: ${detail}`

// What each EntryPoint code most often means for Namera's accounts and paymasters.
const aaHints: Record<string, string> = {
  AA10: "The account is already deployed: drop the factory fields.",
  AA13: "The account's factory call failed or ran out of gas: check the factory data.",
  AA21: "The account can't pay for gas: fund it, or use a paymaster.",
  AA22: "The operation (or the session that signs it) is expired or not valid yet.",
  AA23: "The account's validation reverted: `revert` names the error when Namera knows it.",
  AA24: "The signature is invalid: sign the operation after preparing it, and never change it afterwards.",
  AA25: "The nonce is wrong: wait for the previous operation on this nonce lane before sending the next.",
  AA26: "Validation ran out of gas: raise verificationGasLimit.",
  AA31: "The paymaster's deposit is too low: fund the paymaster or its policy.",
  AA32: "The paymaster's signature is expired or not valid yet: prepare the operation again.",
  AA33:
    "The paymaster's validation reverted. Pimlico's and ZeroDev's paymasters only accept Pimlico's or ZeroDev's bundler.",
  AA34: "The paymaster's signature is invalid: never change an operation after the paymaster signs it.",
  AA40: "Verification used more gas than its limit: raise the verification gas limits.",
  AA50: "The paymaster's postOp reverted, often because the account lacks the token it pays with."
}

/**
 * The bundler rejected the user operation. `code` is its JSON-RPC error code, `aa` the EntryPoint's code (`AA23`,
 * …) when it gave one, `data` the revert data, and `revert` the decoded error (`PolicyViolation(SpendPolicy)`) when
 * Namera knows it.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class Rejected extends Data.TaggedError("Rejected")<{
  readonly code: number
  readonly aa?: string
  readonly data?: `0x${string}`
  readonly revert?: string
  readonly detail?: string
}> {
  override get message(): string {
    const what = this.aa === undefined ? `code ${this.code}` : this.aa
    const revert = this.revert === undefined ? "" : ` (${this.revert})`
    return withDetail(`The bundler rejected the user operation with ${what}${revert}`, this.detail)
  }

  /** What to do about it. */
  get hint(): string {
    return (this.aa === undefined ? undefined : aaHints[this.aa])
      ?? "Read the bundler's message in `details`; `NameraError.decode` names the reason when it knows it."
  }
}

/**
 * The bundler doesn't support a JSON-RPC method Namera or viem called.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class Unsupported extends Data.TaggedError("Unsupported")<{
  readonly method: string
  readonly detail?: string
}> {
  override get message(): string {
    return withDetail(`The bundler does not support ${this.method}`, this.detail)
  }

  /** What to do about it. */
  get hint(): string {
    return "Use the vendor's helper (`Bundler.pimlico`, …), which calls the vendor's own methods."
  }
}

/**
 * The bundler accepted the user operation and never included it, or it wasn't included in time. `hash` is the
 * operation's hash, when known.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class Dropped extends Data.TaggedError("Dropped")<{ readonly hash?: `0x${string}`; readonly detail?: string }> {
  override get message(): string {
    return withDetail("The user operation was not included", this.detail)
  }

  /** What to do about it. */
  get hint(): string {
    return "It may still be included: Etherspot takes about 95 s, so raise `waitForUserOperationReceipt`'s timeout before sending again on the same nonce."
  }
}

/**
 * The specific failure behind a `BundlerError`.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type BundlerErrorReason = Rejected | Unsupported | Dropped

/**
 * A failure from a bundler. `reason` says which; `vendor` and `url` say where, when known. `url` never includes
 * credentials.
 *
 * **Example** (Narrowing on the EntryPoint code)
 *
 * ```ts import.meta.vitest
 * import { BundlerError } from "@namera-ai/sdk"
 *
 * const error = BundlerError.rejected({ code: -32500, aa: "AA21", vendor: "pimlico" })
 *
 * error instanceof BundlerError.BundlerError && error.reason._tag === "Rejected" // => true
 * error.shortMessage // => "The bundler rejected the user operation with AA21"
 * error.metaMessages[0] // => "Bundler: pimlico"
 * ```
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class BundlerError extends Data.TaggedError("BundlerError")<{
  readonly vendor?: string
  readonly url?: string
  readonly reason: BundlerErrorReason
}> implements NameraError.Fields {
  readonly [TypeId] = TypeId
  readonly [NameraErrorTypeId] = NameraErrorTypeId

  override readonly cause = this.reason

  get shortMessage(): string {
    return this.reason.message
  }

  get details(): string | undefined {
    return this.reason.detail
  }

  get docsPath(): string | undefined {
    return undefined
  }

  get metaMessages(): ReadonlyArray<string> {
    return [
      ...(this.vendor === undefined ? [] : [`Bundler: ${this.vendor}`]),
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
 * Checks whether a value is a `BundlerError`, from any copy of the package.
 *
 * @stability experimental
 * @category guards
 * @since 2.0.0
 */
export const isBundlerError = (u: unknown): u is BundlerError => Predicate.hasProperty(u, TypeId)

/**
 * The options every `BundlerError` constructor accepts: the bundler's vendor and endpoint (stored without
 * credentials), and a detail for the message (the bundler's own words).
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

const make = (reason: BundlerErrorReason, { url, vendor }: Options) =>
  new BundlerError({
    reason,
    ...(vendor === undefined ? {} : { vendor }),
    ...(url === undefined ? {} : { url: redactUrl(url) })
  })

const detailOf = ({ detail }: Options) => (detail === undefined ? {} : { detail })

/**
 * Creates a `BundlerError` for a rejected user operation.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const rejected = (
  options: Options & {
    readonly code: number
    readonly aa?: string | undefined
    readonly data?: `0x${string}` | undefined
    readonly revert?: string | undefined
  }
): BundlerError =>
  make(
    new Rejected({
      ...detailOf(options),
      code: options.code,
      ...(options.aa === undefined ? {} : { aa: options.aa }),
      ...(options.data === undefined ? {} : { data: options.data }),
      ...(options.revert === undefined ? {} : { revert: options.revert })
    }),
    options
  )

/**
 * Creates a `BundlerError` for a method the bundler doesn't support.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const unsupported = (options: Options & { readonly method: string }): BundlerError =>
  make(new Unsupported({ ...detailOf(options), method: options.method }), options)

/**
 * Creates a `BundlerError` for a user operation that wasn't included.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const dropped = (options: Options & { readonly hash?: `0x${string}` | undefined } = {}): BundlerError =>
  make(new Dropped({ ...detailOf(options), ...(options.hash === undefined ? {} : { hash: options.hash }) }), options)
