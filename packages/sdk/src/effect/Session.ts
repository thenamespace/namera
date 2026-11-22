/**
 * The Effect form of `Session`: sessions, with time read from Effect's `Clock`.
 *
 * @stability experimental
 * @since 2.0.0
 */
import * as Clock from "effect/Clock"
import * as Effect from "effect/Effect"

import { secondsFromMillis } from "../internal/core/session.ts"

/**
 * Returns the current time in whole seconds from Effect's `Clock`, the unit of a session's `validAfter` and
 * `validUntil`.
 *
 * **Details**
 *
 * Reading the time from `Clock` lets tests control it with `TestClock`.
 *
 * **Example** (Reading the time under a test clock)
 *
 * ```ts import.meta.vitest
 * import { Session } from "@namera-ai/sdk/effect"
 * import { Effect } from "effect"
 * import { TestClock } from "effect/testing"
 *
 * const program = Effect.gen(function*() {
 *   yield* TestClock.setTime(1_700_000_000_500)
 *   return yield* Session.now()
 * }).pipe(Effect.provide(TestClock.layer()))
 *
 * await Effect.runPromise(program) // => 1_700_000_000
 * ```
 *
 * @stability experimental
 * @category getters
 * @since 2.0.0
 */
export const now = (): Effect.Effect<number> => Effect.map(Clock.currentTimeMillis, secondsFromMillis)
