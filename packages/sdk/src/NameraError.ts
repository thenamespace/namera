/**
 * The union of every error Namera raises, and the checks shared by all of them.
 *
 * **Details**
 *
 * Namera has one error class per failure family (`ChainError`, …), each with a tagged `reason` for the specific
 * failure. This module is not a class: it holds the `NameraError` union, a guard that recognises every family, the
 * fields every family shares with viem's `BaseError` (`shortMessage`, `details`, `docsPath`, `metaMessages`,
 * `version`), `decode` for failed viem calls, and `toJSON` and `fromJSON` for sending errors to another process.
 *
 * @stability experimental
 * @since 2.0.0
 */
import * as Result from "effect/Result"
import type { AccountError } from "./accounts/AccountError.ts"
import type { ChainError } from "./ChainError.ts"
import type { GrantError } from "./GrantError.ts"

import type { BundlerError } from "./infra/BundlerError.ts"
import type { CompatError } from "./infra/CompatError.ts"
import type { PaymasterError } from "./infra/PaymasterError.ts"
import { decode as decodeFailure } from "./internal/decode.ts"
import * as errorJson from "./internal/errorJson.ts"
import * as internal from "./internal/nameraError.ts"
import type { KeystoreError } from "./keys/KeystoreError.ts"
import type { SessionKeyError } from "./keys/SessionKeyError.ts"
import type { PolicyViolationError } from "./PolicyViolationError.ts"
import type * as SerializationError from "./SerializationError.ts"
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
  | SerializationError.SerializationError
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

/**
 * A Namera error as plain JSON, version 1: what `NameraError.toJSON` writes and `NameraError.fromJSON` reads.
 *
 * **Details**
 *
 * - `format`: `1`.
 * - `_tag`: the family (`ChainError`, …), and the family's own fields beside it (`method`, `chainId`, `url`;
 *   `account`; `store`; `vendor`), as on the error.
 * - `reason`: the reason's `_tag` and fields; for a `PolicyViolationError`, the first of `violations`, which lists
 *   them all. Bigints are `{ "$n": "<decimal>" }`, as in grants.
 * - A reason's `cause` is reduced to `{ name, message }`: the cause's `shortMessage` (or its message's first line),
 *   URLs redacted. Its full message, stack and fields are dropped: viem's message holds the request body and URL.
 * - viem's fields (`shortMessage`, `details`, `docsPath`, `metaMessages`, `version`), for readers without the SDK.
 *   `fromJSON` ignores them and derives them again from the fields.
 *
 * Text never includes credentials: URLs are redacted in every string, as errors show them. No key or signature is
 * among the fields.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Json = errorJson.Json

/**
 * A reason as plain JSON: its `_tag` and fields.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type ReasonJson = errorJson.ReasonJson

/**
 * Writes a Namera error as plain, versioned JSON, to send to another process.
 *
 * **When to use**
 *
 * Use when an error crosses a process boundary: an EIP-1193 provider's error `data`, an agent tool's result, a worker's
 * message. `JSON.stringify` the result, and rebuild the error on the other side with `NameraError.fromJSON`.
 *
 * **Details**
 *
 * The JSON holds the family's and reason's fields, a summary of the cause, and viem's error fields, as `Json`
 * describes: never keys, signatures or URLs with credentials.
 *
 * **Example** (Sending an error and reading it back)
 *
 * ```ts import.meta.vitest
 * import { ChainError, NameraError } from "@namera-ai/sdk"
 *
 * const json = NameraError.toJSON(
 *   ChainError.rpc({ code: -32601, method: "eth_chainId", url: "https://rpc.example/v2/sk_0123456789abcdef" })
 * )
 * json.url // => "https://rpc.example/v2/***"
 *
 * const error = NameraError.fromJSON(JSON.parse(JSON.stringify(json)))
 * error instanceof ChainError.ChainError && error.reason._tag // => "Rpc"
 * ```
 *
 * @see {@link fromJSON} for reading it back
 * @stability experimental
 * @category encoding
 * @since 2.0.0
 */
export const toJSON: (error: NameraError) => Json = errorJson.toJson

/**
 * Rebuilds the Namera error `NameraError.toJSON` wrote, as an instance of the same family and reason classes, so
 * `instanceof`, `isNameraError`, the family guards and `Effect.catchReason` work on it.
 *
 * **Details**
 *
 * The input is read strictly: an unknown family or reason, a missing field, a field of the wrong kind or an unknown
 * field throws. A reason's cause comes back as an `Error` with the summary's name and message. viem's fields are
 * derived again from the fields, so `version` is this SDK's.
 *
 * **Gotchas**
 *
 * Throws `SerializationError`: `Malformed` for input that isn't a serialized error, `VersionUnsupported` for a format
 * other than 1.
 *
 * @see {@link toJSON} for writing it
 * @stability experimental
 * @category decoding
 * @since 2.0.0
 */
export const fromJSON = (json: unknown): NameraError => Result.getOrThrow(errorJson.fromJson(json))
