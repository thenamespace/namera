/**
 * Sessions: what an agent's session key may do, for how long, under which policies.
 *
 * **Details**
 *
 * A session is a signer (the agent's `SessionKey`), a time window and a list of `Policy` values. Building one does
 * no I/O. `Session.validate` reports every problem with stable codes, `Session.describe` says what the session
 * allows in plain language, and the session compiles to Namera's Smart Sessions and policy contracts, the same on
 * every chain.
 *
 * @stability experimental
 * @since 2.0.0
 */
import * as Predicate from "effect/Predicate"
import * as Result from "effect/Result"

import { secondsFromMillis } from "./internal/core/session.ts"
import type * as compile from "./internal/core/session/compile.ts"
import type * as DescribeCore from "./internal/core/session/describe.ts"
import { describe as describeCore } from "./internal/core/session/describe.ts"
import type * as core from "./internal/core/session/session.ts"
import { validate as validateCore } from "./internal/core/session/validate.ts"
import { contracts } from "./internal/session/contracts.ts"
import * as internal from "./internal/session/session.ts"
import type * as SessionKey from "./keys/SessionKey.ts"
import type * as Policy from "./Policy.ts"
import type * as SessionError from "./SessionError.ts"

/**
 * A session, normalised by `Session.from`: policies sorted and deduplicated, a salt always set.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Session = core.Session

/**
 * Checks whether a value is a `Session`.
 *
 * @stability experimental
 * @category guards
 * @since 2.0.0
 */
export const isSession = (u: unknown): u is Session =>
  Predicate.hasProperty(u, "signer") && Predicate.hasProperty(u, "policies") && Array.isArray(u.policies)
  && Predicate.hasProperty(u, "salt") && Predicate.isString(u.salt)
  && Predicate.hasProperty(u, "validUntil") && Predicate.hasProperty(u, "validAfter")

/**
 * Builds a session from its signer, window and policies, and normalises it: policies sorted and deduplicated, a
 * random salt unless one is given.
 *
 * **Details**
 *
 * `validUntil` is required: a session without an end needs `validUntil: "never"` with `unsafe: true`. `validAfter`
 * defaults to 0 (valid at once). `sponsored` lets the session's operations use a paymaster. `label` stays off chain.
 *
 * **Gotchas**
 *
 * Throws `SessionError` (`InvalidSession`) listing every malformed part, such as an invalid address, an unknown
 * function or argument, or a condition on a dynamic argument. A well-formed session can still be refused by
 * `Session.validate`.
 *
 * **Example** (A checkout agent for seven days)
 *
 * ```ts import.meta.vitest
 * import { Policy, Session, SessionKey } from "@namera-ai/sdk"
 *
 * const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
 * const session = Session.from({
 *   signer: SessionKey.ecdsa("0x70997970C51812dc3A010C7d01b50e0d17dc79C8"),
 *   validUntil: Session.expiresIn({ days: 7 }),
 *   policies: [
 *     Policy.erc20Transfer({ token: USDC, to: ["0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"], amount: { lte: 50_000000n } }),
 *     Policy.spend({ token: USDC, amount: 200_000000n, period: "day" }),
 *     Policy.rateLimit({ count: 20, period: "hour" })
 *   ],
 *   label: "checkout agent"
 * })
 *
 * session.policies.length // => 3
 * Session.validate(session).ok // => true
 * ```
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export function from(options: from.Options): Session {
  return Result.getOrThrow(internal.from(options))
}

/**
 * Types of `Session.from`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace from {
  /**
   * The session's signer, window, policies, and whether it may use a paymaster.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options {
    readonly signer: SessionKey.SessionKey
    readonly policies: ReadonlyArray<Policy.Policy>
    readonly validAfter?: number | undefined
    readonly validUntil: number | "never"
    readonly salt?: `0x${string}` | undefined
    readonly sponsored?: boolean | undefined
    readonly unsafe?: boolean | undefined
    readonly label?: string | undefined
  }
  /**
   * The errors `Session.from` can throw.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = SessionError.SessionError
}

/**
 * Checks a session against the contracts' rules and Namera's safety rules, and reports everything at once:
 * `problems` (errors with stable codes) that make the session unusable or not what it says, and `warnings` worth a
 * second look. `ok` is true without problems.
 *
 * **Details**
 *
 * Errors include sessions without call policies, empty or past windows, two limits of one kind, two policies on one
 * call, forbidden targets, oversized signer configs, personal-message signing, and execution policies without rate
 * and gas limits. With `account`, a session signing for the account's own domain is refused too. Warnings include
 * unconditioned address and amount arguments, `Policy.call`, `Policy.anyCall`, sessions over 90 days or without an
 * end, and sponsored sessions without `Policy.gas`.
 *
 * @stability experimental
 * @category utils
 * @since 2.0.0
 */
export function validate(session: Session, options?: validate.Options): validate.ReturnType {
  return validateCore(session, {
    contracts,
    now: options?.now ?? now(),
    account: options?.account
  })
}

/**
 * Types of `Session.validate`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace validate {
  /**
   * The account the session is for, when known, and the time to check against (default: now).
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options {
    readonly account?: `0x${string}` | undefined
    readonly now?: number | undefined
  }
  /**
   * Whether the session is usable, its problems and its warnings.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface ReturnType {
    readonly ok: boolean
    readonly problems: ReadonlyArray<SessionError.Problem>
    readonly warnings: ReadonlyArray<SessionError.Problem>
  }
}

/**
 * Describes a session in plain language, one line each for its signer, window, sponsorship and policies, for owner
 * confirmation screens and agent prompts.
 *
 * **Details**
 *
 * Token amounts show in raw units unless `tokens` gives the token's symbol and decimals.
 *
 * @stability experimental
 * @category utils
 * @since 2.0.0
 */
export function describe(session: Session, options?: describe.Options): ReadonlyArray<string> {
  return describeCore(session, options)
}

/**
 * Types of `Session.describe`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace describe {
  /**
   * Token symbols and decimals to format amounts with, by token address.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options {
    readonly tokens?: DescribeCore.Tokens | undefined
  }
}

/**
 * Returns the session's on-chain id, computed as Smart Sessions does from the session validator, the session key's
 * config and the salt. It is the same on every chain.
 *
 * @stability experimental
 * @category getters
 * @since 2.0.0
 */
export const getPermissionId: (session: Session) => `0x${string}` = internal.permissionId

/**
 * Smart Sessions' `Session` struct, with the field names of its ABI: what `enableSessions` takes and the owner's
 * signature covers.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type SmartSession = compile.Compiled

/**
 * Compiles a session to Smart Sessions' `Session` struct: its session validator and config, an action per allowed
 * call with its policies, user operation policies for the limits (and SessionHook for execution policies), ERC-1271
 * policies and ERC-7739 contents for signing, and its window.
 *
 * **When to use**
 *
 * Use to enable a session yourself, such as with `SmartSession.enableSessions` from the account; grants do it for
 * you.
 *
 * **Example** (Allowing one native transfer target)
 *
 * ```ts import.meta.vitest
 * import { Policy, Session, SessionKey } from "@namera-ai/sdk"
 *
 * const session = Session.from({
 *   signer: SessionKey.ecdsa("0x70997970C51812dc3A010C7d01b50e0d17dc79C8"),
 *   validUntil: 2_000_000_000,
 *   policies: [Policy.nativeTransfer({ to: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65" })]
 * })
 * const struct = Session.toSmartSession(session)
 *
 * struct.actions[0]?.actionTargetSelector // => "0xffffffff"
 * struct.validUntil // => 2_000_000_000
 * ```
 *
 * @stability experimental
 * @category conversions
 * @since 2.0.0
 */
export const toSmartSession: (session: Session) => SmartSession = internal.toSmartSession

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

/**
 * Returns a `validUntil` that long from now, in whole seconds.
 *
 * **Example** (A session for one week)
 *
 * ```ts import.meta.vitest
 * import { Session } from "@namera-ai/sdk"
 *
 * Session.expiresIn({ days: 7 }) > Session.now() // => true
 * ```
 *
 * @stability experimental
 * @category getters
 * @since 2.0.0
 */
export function expiresIn(options: expiresIn.Options): number {
  return now() + internal.duration(options)
}

/**
 * Types of `Session.expiresIn`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace expiresIn {
  /**
   * How long from now: days, hours, minutes and seconds, added up.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options {
    readonly days?: number | undefined
    readonly hours?: number | undefined
    readonly minutes?: number | undefined
    readonly seconds?: number | undefined
  }
}
