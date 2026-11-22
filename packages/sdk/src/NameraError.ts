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
import * as Predicate from "effect/Predicate"

import type { ChainError } from "./ChainError.ts"

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
export const TypeId = "~@namera-ai/sdk/NameraError" as const

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
export type NameraError = ChainError

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
export const isNameraError = (u: unknown): u is NameraError => Predicate.hasProperty(u, TypeId)

/**
 * Returns the Namera error a failure stands for, or the failure itself when it isn't one.
 *
 * **When to use**
 *
 * Use in a `catch` block around viem calls, such as sending a user operation from a Namera session account, to get
 * a typed error to narrow on.
 *
 * **Details**
 *
 * Namera errors are returned as they are. Bundler and viem failures that carry a Namera cause are decoded into it as
 * the corresponding families arrive; anything else is returned unchanged.
 *
 * @stability experimental
 * @category decoding
 * @since 2.0.0
 */
export const decode = <E>(error: E): NameraError | E => error
