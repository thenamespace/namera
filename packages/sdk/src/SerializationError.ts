/**
 * Failures reading a serialized Namera error (`NameraError.fromJSON`): input that isn't one, or a format version this
 * SDK doesn't read.
 *
 * @stability experimental
 * @since 2.0.0
 */
import * as Data from "effect/Data"
import * as Predicate from "effect/Predicate"

import { TypeId as NameraErrorTypeId } from "./internal/nameraError.ts"
import { version } from "./internal/version.ts"
import type * as NameraError from "./NameraError.ts"

const TypeId = "~@namera-ai/sdk/SerializationError" as const

/**
 * The input is not a serialized Namera error: not an object, an unknown family or reason, or a field missing or of the
 * wrong type.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class Malformed extends Data.TaggedError("Malformed")<{ readonly detail: string }> {
  override get message(): string {
    return `The input is not a serialized Namera error: ${this.detail}`
  }

  /** What to do about it. */
  get hint(): string {
    return "Pass the object `NameraError.toJSON` returned, as it was sent."
  }
}

/**
 * The serialized error has a format version this SDK doesn't read.
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class VersionUnsupported extends Data.TaggedError("VersionUnsupported")<{ readonly version: unknown }> {
  override get message(): string {
    return `Serialized error format ${String(this.version)} is not supported`
  }

  /** What to do about it. */
  get hint(): string {
    return "Upgrade @namera-ai/sdk on the reading side; this version reads format 1."
  }
}

/**
 * The specific failure behind a `SerializationError`.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type SerializationErrorReason = Malformed | VersionUnsupported

/**
 * A serialized Namera error that can't be read back. `reason` says why.
 *
 * **Example** (Reading something that isn't a serialized error)
 *
 * ```ts import.meta.vitest
 * import { NameraError, SerializationError } from "@namera-ai/sdk"
 *
 * const caught = (): unknown => {
 *   try {
 *     return NameraError.fromJSON({ _tag: "TeapotError" })
 *   } catch (error) {
 *     return error
 *   }
 * }
 * const error = caught() as SerializationError.SerializationError
 *
 * SerializationError.isSerializationError(error) // => true
 * error.reason._tag // => "Malformed"
 * ```
 *
 * @stability experimental
 * @category errors
 * @since 2.0.0
 */
export class SerializationError extends Data.TaggedError("SerializationError")<{
  readonly reason: SerializationErrorReason
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
 * Checks whether a value is a `SerializationError`, from any copy of the package.
 *
 * @stability experimental
 * @category guards
 * @since 2.0.0
 */
export const isSerializationError = (u: unknown): u is SerializationError => Predicate.hasProperty(u, TypeId)

/**
 * A `SerializationError` for a reason.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const make = (reason: SerializationErrorReason): SerializationError => new SerializationError({ reason })
