/**
 * The union of every error Namera raises, and the checks shared by all of them.
 *
 * **Details**
 *
 * Namera has one error class per failure family (`ChainError`, …), each with a tagged `reason` for the specific
 * failure. This module is not a class: it holds the `NameraError` union, a guard that recognises every family, and
 * the fields every family shares with viem's `BaseError` (`shortMessage`, `details`, `docsPath`, `metaMessages`,
 * `version`).
 *
 * @stability experimental
 * @since 2.0.0
 */
import type { AccountError } from "./accounts/AccountError.ts"
import type { ChainError } from "./ChainError.ts"
import type { GrantError } from "./GrantError.ts"
import type { BundlerError } from "./infra/BundlerError.ts"
import type { CompatError } from "./infra/CompatError.ts"
import type { PaymasterError } from "./infra/PaymasterError.ts"
import { decode as decodeFailure } from "./internal/decode.ts"
import * as internal from "./internal/nameraError.ts"
import type { KeystoreError } from "./keys/KeystoreError.ts"
import type { SessionKeyError } from "./keys/SessionKeyError.ts"
import type { PolicyViolationError } from "./PolicyViolationError.ts"
import type { SessionError } from "./SessionError.ts"

/**
 * Marks every Namera error, whichever copy of the package created it.
 *
 * **Details**
 *
 * The marker is a string rather than a symbol, so errors from a duplicate copy of `@namera-ai/sdk` (two versions in
 * one dependency tree) are still recognised.
 *
 * @stability experimental
 * @category type IDs
 * @since 2.0.0
 */
export const TypeId: "~@namera-ai/sdk/NameraError" = internal.TypeId

/**
 * Any error Namera raises.
 *
 * **Details**
 *
 * Narrow it with `instanceof` on the family class and the reason's `_tag`, or with `Effect.catchTag` and
 * `Effect.catchReason` in the Effect API. `_tag`s are public API and only change in a major release.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type NameraError =
  | AccountError
  | BundlerError
  | ChainError
  | CompatError
  | GrantError
  | KeystoreError
  | PaymasterError
  | PolicyViolationError
  | SessionError
  | SessionKeyError

/**
 * The fields every Namera error shares with viem's `BaseError`, so code written for viem errors reads Namera errors
 * the same way.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export interface Fields {
  /** One sentence saying what failed. `message` is the same text. */
  readonly shortMessage: string
  /** The message of the underlying cause, when there is one. */
  readonly details: string | undefined
  /** The path of the error's page in Namera's documentation, when it has one. */
  readonly docsPath: string | undefined
  /** Extra lines that help diagnose the failure, such as the request that failed. */
  readonly metaMessages: ReadonlyArray<string> | undefined
  /** The package and version that raised the error, as `@namera-ai/sdk@<version>`. */
  readonly version: string
}

/**
 * Checks whether a value is a Namera error of any family.
 *
 * **Details**
 *
 * Works across duplicate copies of the package, where `instanceof` would fail.
 *
 * **Example** (Recognising a Namera error)
 *
 * ```ts import.meta.vitest
 * import { ChainError, NameraError } from "@namera-ai/sdk"
 *
 * NameraError.isNameraError(ChainError.timeout()) // => true
 * NameraError.isNameraError(new Error("boom")) // => false
 * ```
 *
 * @stability experimental
 * @category guards
 * @since 2.0.0
 */
export const isNameraError: (u: unknown) => u is NameraError = internal.isNameraError

/**
 * Returns the Namera error a failure stands for, or the failure itself when it isn't one.
 *
 * **When to use**
 *
 * Use when catching a failed viem call, such as sending a user operation, to get a typed error to narrow on.
 *
 * **Details**
 *
 * A Namera error, or one in the failure's causes (viem wraps the errors Namera's accounts, bundlers and paymasters
 * throw), is returned as it is. Otherwise the bundler's or paymaster's answer is read from viem's error chain:
 *
 * - revert data (as hex, JSON or Candide's Python bytes): Smart Sessions' refusals become `PolicyViolationError`
 *   where the revert says enough (`PaymasterNotAllowed`, `SessionRevoked`, `RateLimited`, `SignatureNotAllowed`),
 *   and the paymaster allowlist's `BundlerNotAllowed` (`0x55d3ab46`) becomes `PaymasterError` (`BundlerBound`);
 * - vendors' JSON-RPC errors: an inactive sponsorship policy (`PolicyInactive`), too little balance
 *   (`InsufficientBalance`), any other paymaster refusal (`Rejected`), and EIP-7702 refused on EntryPoint 0.7
 *   (`CompatError`);
 * - EntryPoint codes: `BundlerError` (`Rejected`, with `aa` and the decoded `revert`, such as
 *   `PolicyViolation(SpendPolicy)` for limits the revert has no amounts for), `Unsupported` for a missing method,
 *   and `Dropped` for a receipt that never came.
 *
 * Messages are kept with URLs redacted. Anything else is returned unchanged.
 *
 * **Example** (A paymaster that only accepts its own bundlers)
 *
 * ```ts import.meta.vitest
 * import { NameraError, PaymasterError } from "@namera-ai/sdk"
 *
 * // What Etherspot's bundler answered for Pimlico's paymaster (Base Sepolia, 2026-11-15)
 * const failure = Object.assign(new Error("RPC Request failed."), {
 *   code: -32500,
 *   details: `FailedOpWithRevert(0,"AA33 reverted",0x55d3ab46${"0".repeat(64)})`
 * })
 *
 * const error = NameraError.decode(failure)
 * PaymasterError.isPaymasterError(error) && error.reason._tag // => "BundlerBound"
 * ```
 *
 * @stability experimental
 * @category decoding
 * @since 2.0.0
 */
export const decode: <E>(error: E) => NameraError | E = decodeFailure
