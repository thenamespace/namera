/**
 * Sessions: what an agent's session key may do, for how long, under which policies.
 *
 * @stability experimental
 * @since 2.0.0
 */
import { secondsFromMillis } from "./internal/core/session.ts"

/**
 * Returns the current time in whole seconds, the unit of a session's `validAfter` and `validUntil`.
 *
 * **When to use**
 *
 * Use to start a session now or to compute its expiry, for example `Session.now() + 3600` for one hour.
 *
 * **Example** (Expiring a session in one hour)
 *
 * ```ts import.meta.vitest
 * import { Session } from "@namera-ai/sdk"
 *
 * const validAfter = Session.now()
 * const validUntil = validAfter + 3600
 *
 * Number.isInteger(validUntil) // => true
 * ```
 *
 * @stability experimental
 * @category getters
 * @since 2.0.0
 */
export function now(): now.ReturnType {
  return secondsFromMillis(Date.now())
}

/**
 * Types of `Session.now`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace now {
  /**
   * The current time in whole seconds since the Unix epoch.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ReturnType = number
}
