import * as Address from "ox/Address"
import * as Value from "ox/Value"

import { type Comparison, Operator, type Word } from "./condition.ts"
import type { Policy } from "./policy.ts"
import { resolve, type Resolved } from "./resolve.ts"
import type { Session } from "./session.ts"

// Plain-language lines for a session, for owner confirmation screens and agent prompts.

/**
 * Token metadata `describe` formats amounts with, keyed by token address (any case).
 *
 * @internal
 */
export interface Tokens {
  readonly [address: string]: { readonly symbol: string; readonly decimals: number }
}

/** @internal */
export interface DescribeOptions {
  readonly tokens?: Tokens | undefined
}

const tokenOf = (tokens: Tokens | undefined, address: string) =>
  Object.entries(tokens ?? {}).find(([key]) => key.toLowerCase() === address.toLowerCase())?.[1]

const amount = (value: bigint, token: string | undefined, tokens: Tokens | undefined): string => {
  if (token === undefined) return `${Value.formatEther(value)} native`
  const metadata = tokenOf(tokens, token)
  return metadata === undefined
    ? `${value} (raw units of ${token})`
    : `${Value.format(value, metadata.decimals)} ${metadata.symbol}`
}

const period = (seconds: number): string => {
  switch (seconds) {
    case 0:
      return "in total"
    case 3600:
      return "per hour"
    case 86400:
      return "per day (UTC)"
    case 604800:
      return "per week"
    case 2592000:
      return "per 30 days"
    default:
      return `per ${seconds} seconds`
  }
}

const word = (value: bigint | string, kind: Word, format: (value: bigint) => string): string => {
  const ref = BigInt(value)
  switch (kind.type) {
    case "address":
      return Address.checksum(`0x${ref.toString(16).padStart(40, "0")}`)
    case "bool":
      return ref === BigInt(0) ? "false" : "true"
    case "uint":
      return format(ref)
    case "bytes":
      return `0x${ref.toString(16).padStart(64, "0").slice(0, kind.size * 2)}`
    case "hash":
      return `the ${kind.of} hashing to 0x${ref.toString(16).padStart(64, "0")}`
  }
}

/**
 * A condition in words: "is X", "is one of X, Y", "is at most X", ….
 *
 * @internal
 */
export const condition = (comparison: Comparison, kind: Word, format: (value: bigint) => string = String): string => {
  const refs = comparison.refs.map((ref) => word(ref, kind, format))
  switch (comparison.operator) {
    case Operator.eq:
      return `is ${refs[0]}`
    case Operator.neq:
      return `is not ${refs[0]}`
    case Operator.lt:
      return `is less than ${refs[0]}`
    case Operator.lte:
      return `is at most ${refs[0]}`
    case Operator.gt:
      return `is more than ${refs[0]}`
    case Operator.gte:
      return `is at least ${refs[0]}`
    case Operator.between:
      return `is from ${refs[0]} to ${refs[1]}`
    case Operator.oneOf:
      return `is one of ${refs.join(", ")}`
  }
}

const signer = (session: Session): string => {
  const key = session.signer
  if (key.type === "ecdsa") {
    return key.signers.length === 1
      ? `Signed by the session key ${key.signers[0]}.`
      : `Signed by ${key.threshold} of the session keys ${key.signers.join(", ")}.`
  }
  return key.passkeys.length === 1
    ? "Signed by a passkey session key."
    : `Signed by ${key.threshold} of ${key.passkeys.length} passkey session keys.`
}

const time = (seconds: number) => new Date(seconds * 1000).toISOString()

const window = (session: Session): string => {
  const from = session.validAfter === 0 ? "now" : time(session.validAfter)
  return session.validUntil === "never"
    ? `Valid from ${from} until revoked: it never expires.`
    : `Valid from ${from} until ${time(session.validUntil)}.`
}

const callLine = (
  resolved: Resolved,
  index: number,
  head: string,
  token: string | undefined,
  tokens: Tokens | undefined
): string => {
  const rules = resolved.actions.filter((action) => action.source === index).flatMap((action) => action.rules)
  const unique = [...new Map(rules.map((rule) => [`${rule.argument}:${rule.offset}`, rule])).values()]
  if (unique.length === 0) return `${head}, with any arguments.`
  const where = unique.map((rule) => {
    const format = rule.argument === "value"
      ? (value: bigint) => amount(value, undefined, tokens)
      : rule.argument === "amount" && token !== undefined
      ? (value: bigint) => amount(value, token, tokens)
      : String
    return `${rule.argument} ${condition(rule.comparison, rule.word, format)}`
  })
  return `${head}, where ${where.join(" and ")}.`
}

const policyLine = (policy: Policy, index: number, resolved: Resolved, tokens: Tokens | undefined): string => {
  switch (policy.type) {
    case "function": {
      const action = resolved.actions.find((entry) => entry.source === index)!
      return callLine(resolved, index, `May call ${policy.functionName} on ${action.target}`, undefined, tokens)
    }
    case "erc20Transfer":
      return callLine(resolved, index, `May transfer ${tokenName(policy.token, tokens)}`, policy.token, tokens)
    case "erc20Approve":
      return callLine(resolved, index, `May approve spending ${tokenName(policy.token, tokens)}`, policy.token, tokens)
    case "nativeTransfer": {
      const targets = resolved.actions.filter((action) => action.source === index).map((action) => action.target)
      return callLine(resolved, index, `May send native currency to ${targets.join(", ")}`, undefined, tokens)
    }
    case "call":
      return callLine(
        resolved,
        index,
        `May call ${policy.selector} on ${Address.checksum(policy.to)}`,
        undefined,
        tokens
      )
    case "anyCall":
      return "May call any contract with any arguments, except the account itself (unsafe)."
    case "spend":
      return `May spend at most ${amount(policy.amount, policy.token, tokens)} ${
        period(resolved.spends.find((spend) => spend.source === index)!.period)
      }, transfers and approvals counted.`
    case "value":
      return `May send at most ${amount(policy.amount, undefined, tokens)} ${
        period(resolved.values.find((entry) => entry.source === index)!.period)
      }.`
    case "rateLimit":
      return `May send at most ${policy.count} operation${policy.count === 1 ? "" : "s"} ${
        period(resolved.rateLimits.find((entry) => entry.source === index)!.period)
      }.`
    case "gas":
      return `May use at most ${amount(policy.maxCost, undefined, tokens)} of gas ${
        period(resolved.gas.find((entry) => entry.source === index)!.period)
      }, sponsored operations included.`
    case "approvals": {
      const approval = resolved.approvals.find((entry) => entry.source === index)!
      return `Approvals (\`approve\`, or through Permit2) only to ${
        approval.spenders.map((spender) => Address.checksum(spender)).join(", ")
      }, for at most ${approval.tokens.map((token, i) => amount(approval.caps[i]!, token, tokens)).join(", ")}.`
    }
    case "signTypedData": {
      const signature = resolved.signatures.find((entry) => entry.source === index)!
      const domain = policy.domain.name === undefined
        ? signature.verifier
        : `${policy.domain.name} (${signature.verifier})`
      const where = signature.fields.map((field) => `${field.field} ${condition(field.comparison, field.word)}`)
      return `May sign ${policy.primaryType} messages for ${domain}${
        where.length === 0 ? "" : `, where ${where.join(" and ")}`
      }.`
    }
    case "signMessage":
      return "May sign personal messages (not supported by Smart Sessions)."
    case "execution":
      return `Every operation is checked by the execution policy ${Address.checksum(policy.address)}.`
    case "custom":
      return policy.kind === "call"
        ? `May call ${policy.selector} on ${Address.checksum(policy.to)}, as the policy ${
          Address.checksum(policy.address)
        } allows.`
        : `Checked by the custom ${policy.kind} policy ${Address.checksum(policy.address)}.`
  }
}

const tokenName = (token: string, tokens: Tokens | undefined): string => {
  const metadata = tokenOf(tokens, token)
  return metadata === undefined ? Address.checksum(token) : `${metadata.symbol} (${Address.checksum(token)})`
}

/**
 * Describes a session in plain language: its signer, window, sponsorship and one line per policy.
 *
 * @internal
 */
export const describe = (session: Session, options?: DescribeOptions): ReadonlyArray<string> => {
  const result = resolve(session.policies)
  if ("problems" in result) return result.problems.map((entry) => entry.message)
  const lines = [signer(session), window(session)]
  if (session.sponsored) lines.push("May use a paymaster to pay for gas.")
  session.policies.forEach((policy, index) => lines.push(policyLine(policy, index, result.resolved, options?.tokens)))
  return lines
}
