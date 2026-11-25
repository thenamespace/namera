/**
 * The union of every error Namera raises, shared with the Promise API; `fromJSON` fails in the error channel.
 *
 * @stability experimental
 * @since 2.0.0
 */
import * as Effect from "effect/Effect"

import * as errorJson from "../internal/errorJson.ts"
import type { NameraError } from "../NameraError.ts"
import type * as SerializationError from "../SerializationError.ts"

export * from "../NameraError.ts"

/**
 * Rebuilds the Namera error `NameraError.toJSON` wrote, failing with `SerializationError` (`Malformed`,
 * `VersionUnsupported`) for input it can't read.
 *
 * **Example** (Recovering from input that isn't a serialized error)
 *
 * ```ts import.meta.vitest
 * import { NameraError } from "@namera-ai/sdk/effect"
 * import { Effect } from "effect"
 *
 * const reason = NameraError.fromJSON({ format: 2 }).pipe(
 *   Effect.flip,
 *   Effect.map((error) => error.reason._tag)
 * )
 *
 * await Effect.runPromise(reason) // => "VersionUnsupported"
 * ```
 *
 * @stability experimental
 * @category decoding
 * @since 2.0.0
 */
export const fromJSON = (json: unknown): Effect.Effect<NameraError, SerializationError.SerializationError> =>
  Effect.fromResult(errorJson.fromJson(json))
