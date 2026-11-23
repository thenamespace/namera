/**
 * The Effect form of `Session`: sessions, with time read from Effect's `Clock` and failures in the error channel.
 *
 * @stability experimental
 * @since 2.0.0
 */
import * as Clock from "effect/Clock"
import * as Effect from "effect/Effect"

import { secondsFromMillis } from "../internal/core/session.ts"
import { validate as validateCore } from "../internal/core/session/validate.ts"
import { contracts } from "../internal/session/contracts.ts"
import * as internal from "../internal/session/session.ts"
import * as Session_ from "../Session.ts"
import type * as SessionError from "../SessionError.ts"

/**
 * A session, normalised by `Session.from`.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Session = Session_.Session

/**
 * Checks whether a value is a `Session`.
 *
 * @stability experimental
 * @category guards
 * @since 2.0.0
 */
export const isSession: (u: unknown) => u is Session = Session_.isSession

/**
 * Builds a session from its signer, window and policies, and normalises it, failing with `SessionError`
 * (`InvalidSession`) listing every malformed part.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const from = (options: Session_.from.Options): Effect.Effect<Session, SessionError.SessionError> =>
  Effect.fromResult(internal.from(options))

/**
 * Checks a session against the contracts' rules and Namera's safety rules at the `Clock`'s time, reporting every
 * problem and warning at once.
 *
 * @stability experimental
 * @category utils
 * @since 2.0.0
 */
export const validate = (
  session: Session,
  options?: { readonly account?: `0x${string}` | undefined }
): Effect.Effect<Session_.validate.ReturnType> =>
  Effect.map(now(), (seconds) => validateCore(session, { contracts, now: seconds, account: options?.account }))

/**
 * Describes a session in plain language.
 *
 * @stability experimental
 * @category utils
 * @since 2.0.0
 */
export const describe: (session: Session, options?: Session_.describe.Options) => ReadonlyArray<string> =
  Session_.describe

/**
 * Returns the session's on-chain id, the same on every chain.
 *
 * @stability experimental
 * @category getters
 * @since 2.0.0
 */
export const getPermissionId: (session: Session) => `0x${string}` = Session_.getPermissionId

/**
 * Smart Sessions' `Session` struct.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type SmartSession = Session_.SmartSession

/**
 * Compiles a session to Smart Sessions' `Session` struct.
 *
 * @stability experimental
 * @category conversions
 * @since 2.0.0
 */
export const toSmartSession: (session: Session) => SmartSession = Session_.toSmartSession

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

/**
 * Returns a `validUntil` that long after the `Clock`'s time, in whole seconds.
 *
 * @stability experimental
 * @category getters
 * @since 2.0.0
 */
export const expiresIn = (options: Session_.expiresIn.Options): Effect.Effect<number> =>
  Effect.map(now(), (seconds) => seconds + internal.duration(options))
