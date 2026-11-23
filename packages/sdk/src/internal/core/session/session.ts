import * as Hex from "ox/Hex"

import type { EcdsaSessionKey, PasskeySessionKey } from "../sessionKey.ts"
import type { Policy } from "./policy.ts"
import { type Problem, problem } from "./problem.ts"
import { resolve } from "./resolve.ts"

/**
 * A session: who signs (the agent's session key), when, what it may do (its policies), and whether it may use a
 * paymaster. Normalised by `make`: policies sorted and deduplicated, a salt always set.
 */
export interface Session {
  readonly signer: EcdsaSessionKey | PasskeySessionKey
  readonly policies: ReadonlyArray<Policy>
  readonly validAfter: number
  readonly validUntil: number | "never"
  readonly salt: Hex.Hex
  readonly sponsored: boolean
  readonly unsafe: boolean
  readonly label?: string | undefined
}

/**
 * What a session is built from: `validAfter` defaults to 0 (now), `salt` to 32 random bytes, `sponsored` and
 * `unsafe` to false.
 *
 * @internal
 */
export interface Options {
  readonly signer: EcdsaSessionKey | PasskeySessionKey
  readonly policies: ReadonlyArray<Policy>
  readonly validAfter?: number | undefined
  readonly validUntil: number | "never"
  readonly salt?: Hex.Hex | undefined
  readonly sponsored?: boolean | undefined
  readonly unsafe?: boolean | undefined
  readonly label?: string | undefined
}

const MAX_TIME = 2 ** 48 - 1
const ZERO = `0x${"0".repeat(64)}`

const isTime = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= MAX_TIME

const isSigner = (value: unknown): boolean =>
  typeof value === "object" && value !== null
  && ((value as { type?: unknown }).type === "ecdsa" || (value as { type?: unknown }).type === "passkey")

/**
 * A key for a policy value that is the same for equal values: JSON with sorted keys and bigints marked.
 *
 * @internal
 */
export const canonical = (value: unknown): string =>
  JSON.stringify(value, (_, inner: unknown) => {
    if (typeof inner === "bigint") return `${inner}n`
    if (typeof inner !== "object" || inner === null || Array.isArray(inner)) return inner
    return Object.fromEntries(
      Object.entries(inner).filter(([, field]) => field !== undefined).sort(([a], [b]) => (a < b ? -1 : 1))
    )
  })

/**
 * Builds and normalises a session, or lists everything malformed about it.
 *
 * @internal
 */
export const make = (
  options: Options
): { readonly session: Session } | { readonly problems: ReadonlyArray<Problem> } => {
  const problems: Array<Problem> = []
  if (!isSigner(options.signer)) {
    problems.push(problem("INVALID_DATA", "signer must be a SessionKey (SessionKey.ecdsa, SessionKey.passkey, …)"))
  }

  const validAfter = options.validAfter ?? 0
  if (!isTime(validAfter)) problems.push(problem("INVALID_TIME", "validAfter must be whole seconds from 0 to 2^48 - 1"))
  if (options.validUntil === "never") {
    if (options.unsafe !== true) {
      problems.push(problem("UNSAFE_REQUIRED", "a session without an end (validUntil: \"never\") needs unsafe: true"))
    }
  } else if (!isTime(options.validUntil) || options.validUntil === 0) {
    problems.push(
      problem("INVALID_TIME", "validUntil must be whole seconds from 1 to 2^48 - 1, or \"never\" with unsafe: true")
    )
  }

  const salt = options.salt ?? Hex.random(32)
  if (!Hex.validate(salt) || Hex.size(salt) !== 32 || salt === ZERO) {
    problems.push(problem("INVALID_SALT", "salt must be 32 bytes of hex, not zero"))
  }

  const policies = Array.isArray(options.policies) ? options.policies : []
  if (!Array.isArray(options.policies)) problems.push(problem("INVALID_DATA", "policies must be a list"))
  // Resolved as given, so a problem's index is the caller's.
  const resolved = resolve(policies)
  if ("problems" in resolved) problems.push(...resolved.problems)
  if (problems.length > 0) return { problems }

  const sorted = [...new Map(policies.map((policy) => [canonical(policy), policy] as const)).entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([, policy]) => policy)

  return {
    session: {
      signer: options.signer,
      policies: sorted,
      validAfter,
      validUntil: options.validUntil,
      salt: salt.toLowerCase() as Hex.Hex,
      sponsored: options.sponsored === true,
      unsafe: options.unsafe === true,
      ...(options.label === undefined ? {} : { label: options.label })
    }
  }
}
