import * as Hex from "ox/Hex"

import { validatorData } from "../sessionKey.ts"
import { compile, type Contracts, FALLBACK } from "./compile.ts"
import { type Problem, problem } from "./problem.ts"
import { resolve } from "./resolve.ts"
import type { Session } from "./session.ts"

/**
 * What `Session.validate` found: errors (`problems`) that make the session unusable or not what it says, and
 * `warnings` worth a second look. `ok` is true without problems.
 *
 * @internal
 */
export interface Validation {
  readonly ok: boolean
  readonly problems: ReadonlyArray<Problem>
  readonly warnings: ReadonlyArray<Problem>
}

/** @internal */
export interface ValidateOptions {
  readonly contracts: Contracts
  /** The current time in seconds. */
  readonly now: number
  /** The account the session is for, when known: signing for its own domain is refused. */
  readonly account?: Hex.Hex | undefined
}

/**
 * Smart Sessions keeps a session validator's config in at most 512 bytes.
 *
 * @internal
 */
export const MAX_VALIDATOR_DATA = 512

/**
 * SessionHook runs at most 8 execution policies per session.
 *
 * @internal
 */
export const MAX_EXECUTION_POLICIES = 8

const LONG_SESSION = 90 * 86400
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/**
 * Checks a session against the contracts' rules and Namera's safety rules, reporting everything at once.
 *
 * @internal
 */
export const validate = (session: Session, options: ValidateOptions): Validation => {
  const result = resolve(session.policies)
  if ("problems" in result) return { ok: false, problems: result.problems, warnings: [] }
  const resolved = result.resolved
  const problems: Array<Problem> = []
  const warnings: Array<Problem> = []

  // Calls and the window.
  if (resolved.actions.length === 0 && resolved.anyCall.length === 0 && resolved.signatures.length === 0) {
    problems.push(problem("NO_CALL_POLICY", "the session allows no calls and no signatures: add a call policy"))
  }
  if (session.validUntil !== "never") {
    if (session.validAfter >= session.validUntil) {
      problems.push(problem("EMPTY_WINDOW", "validAfter must be before validUntil"))
    } else if (session.validUntil <= options.now) {
      problems.push(problem("EXPIRY_IN_PAST", "validUntil is in the past"))
    } else if (session.validUntil - Math.max(session.validAfter, options.now) > LONG_SESSION) {
      warnings.push(problem("LONG_SESSION", "the session lasts more than 90 days"))
    }
  } else {
    warnings.push(problem("NO_EXPIRY", "the session never expires: it lasts until revoked"))
  }

  const seen = new Map<string, number>()
  const forbidden = [
    ZERO_ADDRESS,
    FALLBACK.target,
    options.contracts.smartSession,
    ...(resolved.executions.length > 0
      ? [options.contracts.sessionHook, ...resolved.executions.map((execution) => execution.address)]
      : [])
  ]
  for (const action of resolved.actions) {
    if (forbidden.some((address) => same(address, action.target))) {
      problems.push(
        problem(
          "FORBIDDEN_TARGET",
          `${action.target} can't be a session's call target (the zero address, Smart Sessions, SessionHook or an execution policy)`,
          action.source
        )
      )
    }
    const id = `${action.target.toLowerCase()}:${action.selector}`
    const first = seen.get(id)
    if (first !== undefined && first !== action.source) {
      problems.push(
        problem(
          "OVERLAPPING_CALLS",
          `two policies allow ${action.selector} on ${action.target}; put every condition on that call in one policy`,
          action.source
        )
      )
    }
    if (first === undefined) seen.set(id, action.source)
  }

  // Limits: each limit contract takes one configuration per session.
  const spendKeys = new Set<string>()
  for (const spend of resolved.spends) {
    const key = `${spend.token.toLowerCase()}:${spend.period}`
    if (spendKeys.has(key)) {
      problems.push(
        problem("CONFLICTING_LIMITS", `two spend limits for ${spend.token} over the same period`, spend.source)
      )
    }
    spendKeys.add(key)
  }
  for (
    const [entries, name] of [
      [resolved.values, "Policy.value"],
      [resolved.rateLimits, "Policy.rateLimit"],
      [resolved.gas, "Policy.gas"],
      [resolved.approvals, "Policy.approvals"]
    ] as const
  ) {
    for (const extra of entries.slice(1)) {
      problems.push(problem("CONFLICTING_LIMITS", `a session takes one ${name}`, extra.source))
    }
  }

  // Signing.
  for (const source of resolved.signMessages) {
    problems.push(
      problem(
        "SIGN_MESSAGE_UNSUPPORTED",
        "Smart Sessions can't check personal messages (ERC-7739 PersonalSign); use Policy.signTypedData",
        source
      )
    )
  }
  if (options.account !== undefined) {
    for (const signature of resolved.signatures) {
      if (same(signature.verifier, options.account)) {
        problems.push(
          problem(
            "SIGNS_FOR_ACCOUNT",
            "a session may not sign for the account's own domain: the account would accept it as the owner's",
            signature.source
          )
        )
      }
    }
  }

  // Gas: the session key sets the operation's fees, and without a paymaster (which a sponsored session's agent can
  // simply leave out) the account pays them, up to its whole balance, to whoever bundles the operation.
  if (resolved.gas.length === 0) {
    problems.push(
      problem(
        "GAS_LIMIT_REQUIRED",
        "a session needs Policy.gas: the agent sets each operation's fees, and the account pays them without a paymaster"
      )
    )
  }

  // A policy contract listed twice in one list keeps only its last configuration.
  const compiled = compile(session, options.contracts)
  const lists = [
    compiled.userOpPolicies,
    compiled.erc7739Policies.erc1271Policies,
    ...compiled.actions.map((action) => action.actionPolicies)
  ]
  for (const list of lists) {
    const addresses = list.map((entry) => entry.policy.toLowerCase())
    const repeated = addresses.find((address, index) => addresses.indexOf(address) !== index)
    if (repeated !== undefined) {
      problems.push(
        problem("DUPLICATE_POLICY", `policy contract ${repeated} is listed twice where one configuration is kept`)
      )
    }
  }

  // Execution policies.
  if (resolved.executions.length > MAX_EXECUTION_POLICIES) {
    problems.push(
      problem(
        "TOO_MANY_EXECUTION_POLICIES",
        `a session runs at most ${MAX_EXECUTION_POLICIES} execution policies`,
        resolved.executions[MAX_EXECUTION_POLICIES]!.source
      )
    )
  }
  if (resolved.executions.length > 0 && (resolved.rateLimits.length === 0 || resolved.gas.length === 0)) {
    problems.push(
      problem(
        "EXECUTION_WITHOUT_LIMITS",
        "a session with execution policies needs Policy.rateLimit and Policy.gas: a failed execution still costs gas",
        resolved.executions[0]!.source
      )
    )
  }

  if (Hex.size(validatorData(session.signer)) > MAX_VALIDATOR_DATA) {
    problems.push(
      problem(
        "CONFIG_TOO_LARGE",
        `the session key's config is over ${MAX_VALIDATOR_DATA} bytes: use fewer signers (13 keys or 3 passkeys at most)`
      )
    )
  }

  // Warnings.
  for (const entry of resolved.unrestricted) {
    warnings.push(
      problem(
        entry.kind === "address" ? "UNRESTRICTED_ADDRESS_ARG" : "UNRESTRICTED_AMOUNT_ARG",
        `${entry.argument} may be any ${entry.kind === "address" ? "address" : "amount"}`,
        entry.source
      )
    )
  }
  for (const source of resolved.rawCalls) {
    warnings.push(problem("RAW_CALL_POLICY", "Policy.call allows any arguments", source))
  }
  for (const source of resolved.anyCall) {
    warnings.push(problem("ANY_CALL", "Policy.anyCall allows any call on any contract", source))
  }

  return { ok: problems.length === 0, problems, warnings }
}
