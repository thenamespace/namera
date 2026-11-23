import * as Address from "ox/Address"
import * as Hash from "ox/Hash"
import * as Hex from "ox/Hex"
import * as TypedData from "ox/TypedData"

import { type ArgumentRule, resolveFunction } from "./arguments.ts"
import { compare, type Comparison, type Word } from "./condition.ts"
import { type Period, periodSeconds, type Policy } from "./policy.ts"
import { type Problem, problem } from "./problem.ts"

// A session's policies checked and resolved into what the compiler, `Session.validate` and `Session.describe` work
// from: actions (target and selector, with rules), limits, signing rules and extra policy contracts.

/**
 * `ArgPolicy`'s offset that compares the call's value instead of an argument.
 *
 * @internal
 */
export const VALUE_OFFSET = BigInt(2) ** BigInt(256) - BigInt(1)

/**
 * Smart Sessions' selector for a call without calldata (a plain native transfer).
 *
 * @internal
 */
export const VALUE_SELECTOR: Hex.Hex = "0xffffffff"

/** @internal */
export const selectors = {
  transfer: "0xa9059cbb",
  approve: "0x095ea7b3",
  increaseAllowance: "0x39509351",
  permit2Approve: "0x87517c45"
} as const satisfies Record<string, Hex.Hex>

/**
 * Uniswap's Permit2, the same address on every chain.
 *
 * @internal
 */
export const PERMIT2: Address.Address = "0x000000000022D473030F116dDEE9F6B43aC78BA3"

/**
 * One rule on a call: an argument word at `offset`, or the call's value.
 *
 * @internal
 */
export interface CallRule {
  readonly argument: string
  readonly offset: bigint
  readonly word: Word
  readonly comparison: Comparison
}

/**
 * A call the session allows: its target and selector, the rules on it, and the policy it came from.
 *
 * @internal
 */
export interface Action {
  readonly target: Address.Address
  readonly selector: Hex.Hex
  readonly rules: ReadonlyArray<CallRule>
  readonly custom?: { readonly address: Address.Address; readonly initData: Hex.Hex } | undefined
  readonly source: number
}

/**
 * A typed-data struct the session key may sign, with the rules on its fields.
 *
 * @internal
 */
export interface Signature {
  readonly verifier: Address.Address
  readonly domainSeparator: Hex.Hex
  readonly contentsType: string
  readonly typeHash: Hex.Hex
  readonly fields: ReadonlyArray<
    { readonly field: string; readonly index: number; readonly word: Word; readonly comparison: Comparison }
  >
  readonly source: number
}

/**
 * A session's policies, resolved.
 *
 * @internal
 */
export interface Resolved {
  readonly actions: ReadonlyArray<Action>
  readonly anyCall: ReadonlyArray<number>
  readonly spends: ReadonlyArray<
    { readonly token: Address.Address; readonly amount: bigint; readonly period: number; readonly source: number }
  >
  readonly values: ReadonlyArray<{ readonly amount: bigint; readonly period: number; readonly source: number }>
  readonly rateLimits: ReadonlyArray<{ readonly count: number; readonly period: number; readonly source: number }>
  readonly gas: ReadonlyArray<{ readonly maxCost: bigint; readonly period: number; readonly source: number }>
  readonly approvals: ReadonlyArray<{
    readonly tokens: ReadonlyArray<Address.Address>
    readonly spenders: ReadonlyArray<Address.Address>
    readonly maxAmount: bigint
    readonly source: number
  }>
  readonly signatures: ReadonlyArray<Signature>
  readonly signMessages: ReadonlyArray<number>
  readonly executions: ReadonlyArray<
    { readonly address: Address.Address; readonly initData: Hex.Hex; readonly source: number }
  >
  readonly customLimits: ReadonlyArray<
    { readonly address: Address.Address; readonly initData: Hex.Hex; readonly source: number }
  >
  readonly customSignatures: ReadonlyArray<
    { readonly address: Address.Address; readonly initData: Hex.Hex; readonly source: number }
  >
  readonly rawCalls: ReadonlyArray<number>
  readonly unrestricted: ReadonlyArray<
    { readonly argument: string; readonly kind: "address" | "amount"; readonly source: number }
  >
}

const MAX_UINT256 = BigInt(2) ** BigInt(256) - BigInt(1)
const MAX_TIME = 2 ** 48 - 1

const uint256: Word = { type: "uint", bits: 256 }
const address: Word = { type: "address" }

interface Builder {
  actions: Array<Action>
  anyCall: Array<number>
  spends: Array<Resolved["spends"][number]>
  values: Array<Resolved["values"][number]>
  rateLimits: Array<Resolved["rateLimits"][number]>
  gas: Array<Resolved["gas"][number]>
  approvals: Array<Resolved["approvals"][number]>
  signatures: Array<Signature>
  signMessages: Array<number>
  executions: Array<Resolved["executions"][number]>
  customLimits: Array<Resolved["customLimits"][number]>
  customSignatures: Array<Resolved["customSignatures"][number]>
  rawCalls: Array<number>
  unrestricted: Array<Resolved["unrestricted"][number]>
}

const checksum = (value: unknown): Address.Address | undefined =>
  typeof value === "string" && Address.validate(value, { strict: false }) ? Address.checksum(value) : undefined

const isAmount = (value: unknown): value is bigint =>
  typeof value === "bigint" && value >= BigInt(0) && value <= MAX_UINT256

const NAMED_PERIODS: ReadonlyArray<string> = ["hour", "day", "week", "month", "lifetime"]

/** A period's length in seconds, or `undefined` for one that isn't a period. */
const seconds = (period: unknown): number | undefined => {
  if (typeof period === "string") return NAMED_PERIODS.includes(period) ? periodSeconds(period as Period) : undefined
  if (typeof period !== "object" || period === null) return undefined
  const length = (period as { readonly seconds?: unknown }).seconds
  return typeof length === "number" && Number.isSafeInteger(length) && length > 0 && length <= MAX_TIME
    ? length
    : undefined
}

const list = <A>(value: A | ReadonlyArray<A>): ReadonlyArray<A> => (Array.isArray(value) ? value : [value as A])

/** A rule on the call's value, or a message. */
const valueRule = (condition: unknown): CallRule | string | undefined => {
  if (condition === undefined) return undefined
  const comparison = compare(uint256, condition)
  return typeof comparison === "string"
    ? `value: ${comparison}`
    : { argument: "value", offset: VALUE_OFFSET, word: uint256, comparison }
}

const fromArgument = (rule: ArgumentRule): CallRule => ({ ...rule, offset: BigInt(rule.offset) })

/** Conditions on the two arguments of an ERC-20 `transfer(to, amount)` or `approve(spender, amount)`. */
const erc20Rules = (
  first: { readonly name: string; readonly condition: unknown },
  amount: unknown,
  index: number,
  out: Array<Problem>,
  unrestricted: Builder["unrestricted"]
): ReadonlyArray<CallRule> => {
  const rules: Array<CallRule> = []
  if (first.condition === undefined) unrestricted.push({ argument: first.name, kind: "address", source: index })
  else {
    const comparison = compare(address, first.condition)
    if (typeof comparison === "string") out.push(problem("INVALID_CONDITION", `${first.name}: ${comparison}`, index))
    else rules.push({ argument: first.name, offset: BigInt(0), word: address, comparison })
  }
  if (amount === undefined) unrestricted.push({ argument: "amount", kind: "amount", source: index })
  else {
    const comparison = compare(uint256, amount)
    if (typeof comparison === "string") out.push(problem("INVALID_CONDITION", `amount: ${comparison}`, index))
    else rules.push({ argument: "amount", offset: BigInt(32), word: uint256, comparison })
  }
  return rules
}

/** How a typed-data field's word is read, or why a condition on it isn't supported. */
const fieldWord = (type: string, types: TypedDataTypes): Word | string => {
  if (type === "string" || type === "bytes") return { type: "hash", of: type }
  if (type === "address") return { type: "address" }
  if (type === "bool") return { type: "bool" }
  const uint = /^uint(\d*)$/.exec(type)
  if (uint !== null) return { type: "uint", bits: uint[1] === "" ? 256 : Number(uint[1]) }
  const bytes = /^bytes(\d+)$/.exec(type)
  if (bytes !== null) return { type: "bytes", size: Number(bytes[1]) }
  if (type.endsWith("]") || type in types) return `conditions on ${type} fields are not supported`
  return `conditions on ${type} are not supported`
}

type TypedDataTypes = { readonly [name: string]: ReadonlyArray<{ readonly name: string; readonly type: string }> }

const resolveSignature = (
  policy: Extract<Policy, { readonly type: "signTypedData" }>,
  index: number,
  out: Array<Problem>
): Signature | undefined => {
  const verifier = checksum(policy.domain?.verifyingContract)
  if (verifier === undefined) {
    out.push(problem("INVALID_ADDRESS", "the domain needs a verifyingContract address", index))
    return undefined
  }
  const fields = policy.types?.[policy.primaryType]
  if (fields === undefined) {
    out.push(problem("INVALID_TYPED_DATA", `types does not define the primary type ${policy.primaryType}`, index))
    return undefined
  }

  let contentsType: string
  let domainSeparator: Hex.Hex
  try {
    contentsType = TypedData.encodeType({ primaryType: policy.primaryType, types: policy.types as TypedData.TypedData })
    domainSeparator = TypedData.domainSeparator(policy.domain)
  } catch (cause) {
    out.push(problem("INVALID_TYPED_DATA", `the typed data is invalid: ${(cause as Error).message}`, index))
    return undefined
  }

  const rules: Array<Signature["fields"][number]> = []
  for (const [field, condition] of Object.entries(policy.message ?? {})) {
    const position = fields.findIndex((parameter) => parameter.name === field)
    if (position === -1) {
      out.push(problem("UNKNOWN_ARGUMENT", `${field} is not a field of ${policy.primaryType}`, index))
      continue
    }
    const word = fieldWord(fields[position]!.type, policy.types)
    if (typeof word === "string") {
      out.push(problem("UNSUPPORTED_CONDITION", `${field}: ${word}`, index))
      continue
    }
    const comparison = compare(word, condition)
    if (typeof comparison === "string") out.push(problem("INVALID_CONDITION", `${field}: ${comparison}`, index))
    else rules.push({ field, index: position, word, comparison })
  }
  return {
    verifier,
    domainSeparator,
    contentsType,
    typeHash: Hash.keccak256(Hex.fromString(contentsType)),
    fields: rules,
    source: index
  }
}

const resolveOne = (policy: Policy, index: number, builder: Builder, out: Array<Problem>): void => {
  const invalidAddress = (what: string) => out.push(problem("INVALID_ADDRESS", `${what} is not an address`, index))
  const invalidAmount = (what: string) =>
    out.push(problem("INVALID_AMOUNT", `${what} must be a bigint from 0 to 2^256 - 1`, index))
  const invalidPeriod = () =>
    out.push(
      problem(
        "INVALID_PERIOD",
        "period must be hour, day, week, month, lifetime, or { seconds } with a positive whole number",
        index
      )
    )

  switch (policy.type) {
    case "function": {
      const target = checksum(policy.address)
      if (target === undefined) return void invalidAddress("address")
      const resolved = resolveFunction(policy.abi as ReadonlyArray<unknown>, policy.functionName, policy.args)
      if ("code" in resolved) return void out.push(problem(resolved.code, resolved.message, index))
      const value = valueRule(policy.value)
      if (typeof value === "string") return void out.push(problem("INVALID_CONDITION", value, index))
      const rules = resolved.rules.map(fromArgument)
      builder.actions.push({
        target,
        selector: resolved.selector,
        rules: value === undefined ? rules : [...rules, value],
        source: index
      })
      for (const entry of resolved.unrestricted) builder.unrestricted.push({ ...entry, source: index })
      return
    }
    case "erc20Transfer":
    case "erc20Approve": {
      const target = checksum(policy.token)
      if (target === undefined) return void invalidAddress("token")
      const first = policy.type === "erc20Transfer"
        ? { name: "to", condition: policy.to }
        : { name: "spender", condition: policy.spender }
      const before = out.length
      const rules = erc20Rules(first, policy.amount, index, out, builder.unrestricted)
      if (out.length > before) return
      builder.actions.push({
        target,
        selector: policy.type === "erc20Transfer" ? selectors.transfer : selectors.approve,
        rules,
        source: index
      })
      return
    }
    case "nativeTransfer": {
      const targets = list(policy.to).map(checksum)
      if (targets.length === 0 || targets.some((target) => target === undefined)) return void invalidAddress("to")
      const value = valueRule(policy.value)
      if (typeof value === "string") return void out.push(problem("INVALID_CONDITION", value, index))
      for (const target of new Set(targets)) {
        builder.actions.push({
          target: target!,
          selector: VALUE_SELECTOR,
          rules: value === undefined ? [] : [value],
          source: index
        })
      }
      return
    }
    case "call": {
      const target = checksum(policy.to)
      if (target === undefined) return void invalidAddress("to")
      if (typeof policy.selector !== "string" || !Hex.validate(policy.selector) || Hex.size(policy.selector) !== 4) {
        return void out.push(problem("INVALID_SELECTOR", "selector must be 4 bytes of hex", index))
      }
      const value = valueRule(policy.value)
      if (typeof value === "string") return void out.push(problem("INVALID_CONDITION", value, index))
      builder.actions.push({
        target,
        selector: policy.selector.toLowerCase() as Hex.Hex,
        rules: value === undefined ? [] : [value],
        source: index
      })
      builder.rawCalls.push(index)
      return
    }
    case "anyCall":
      if (policy.unsafe !== true) {
        return void out.push(problem("UNSAFE_REQUIRED", "Policy.anyCall needs unsafe: true", index))
      }
      builder.anyCall.push(index)
      return
    case "spend": {
      const token = checksum(policy.token)
      if (token === undefined) return void invalidAddress("token")
      if (!isAmount(policy.amount)) return void invalidAmount("amount")
      const period = seconds(policy.period)
      if (period === undefined) return void invalidPeriod()
      builder.spends.push({ token, amount: policy.amount, period, source: index })
      return
    }
    case "value": {
      if (!isAmount(policy.amount)) return void invalidAmount("amount")
      const period = seconds(policy.period)
      if (period === undefined) return void invalidPeriod()
      builder.values.push({ amount: policy.amount, period, source: index })
      return
    }
    case "rateLimit": {
      if (!Number.isSafeInteger(policy.count) || policy.count < 1) {
        return void out.push(problem("INVALID_AMOUNT", "count must be a positive whole number", index))
      }
      const period = seconds(policy.period)
      if (period === undefined) return void invalidPeriod()
      builder.rateLimits.push({ count: policy.count, period, source: index })
      return
    }
    case "gas": {
      if (!isAmount(policy.maxCost)) return void invalidAmount("maxCost")
      const period = seconds(policy.period)
      if (period === undefined) return void invalidPeriod()
      builder.gas.push({ maxCost: policy.maxCost, period, source: index })
      return
    }
    case "approvals": {
      const tokens = (policy.tokens ?? []).map(checksum)
      const spenders = (policy.spenders ?? []).map(checksum)
      if (tokens.length === 0 || tokens.some((token) => token === undefined)) return void invalidAddress("tokens")
      if (spenders.length === 0 || spenders.some((spender) => spender === undefined)) {
        return void invalidAddress("spenders")
      }
      if (!isAmount(policy.maxAmount)) return void invalidAmount("maxAmount")
      builder.approvals.push({
        tokens: [...new Set(tokens as Array<Address.Address>)],
        spenders: [...new Set(spenders as Array<Address.Address>)],
        maxAmount: policy.maxAmount,
        source: index
      })
      return
    }
    case "signTypedData": {
      const signature = resolveSignature(policy, index, out)
      if (signature !== undefined) builder.signatures.push(signature)
      return
    }
    case "signMessage":
      builder.signMessages.push(index)
      return
    case "execution":
    case "custom": {
      const contract = checksum(policy.address)
      if (contract === undefined) return void invalidAddress("address")
      if (typeof policy.initData !== "string" || !Hex.validate(policy.initData)) {
        return void out.push(problem("INVALID_DATA", "initData must be hex", index))
      }
      const entry = { address: contract, initData: policy.initData, source: index }
      if (policy.type === "execution") return void builder.executions.push(entry)
      if (policy.kind !== "call") {
        return void (policy.kind === "limit" ? builder.customLimits : builder.customSignatures).push(entry)
      }
      const target = checksum(policy.to)
      if (target === undefined) return void invalidAddress("to")
      if (typeof policy.selector !== "string" || !Hex.validate(policy.selector) || Hex.size(policy.selector) !== 4) {
        return void out.push(problem("INVALID_SELECTOR", "selector must be 4 bytes of hex", index))
      }
      builder.actions.push({
        target,
        selector: policy.selector.toLowerCase() as Hex.Hex,
        rules: [],
        custom: { address: contract, initData: policy.initData },
        source: index
      })
      return
    }
    default:
      out.push(problem("INVALID_DATA", "not a policy built with Policy.*", index))
  }
}

/**
 * Resolves a session's policies, or lists every malformed one.
 *
 * @internal
 */
export const resolve = (
  policies: ReadonlyArray<Policy>
): { readonly resolved: Resolved } | { readonly problems: ReadonlyArray<Problem> } => {
  const builder: Builder = {
    actions: [],
    anyCall: [],
    spends: [],
    values: [],
    rateLimits: [],
    gas: [],
    approvals: [],
    signatures: [],
    signMessages: [],
    executions: [],
    customLimits: [],
    customSignatures: [],
    rawCalls: [],
    unrestricted: []
  }
  const problems: Array<Problem> = []
  policies.forEach((policy, index) => {
    if (typeof policy !== "object" || policy === null) {
      problems.push(problem("INVALID_DATA", "not a policy built with Policy.*", index))
      return
    }
    resolveOne(policy, index, builder, problems)
  })
  return problems.length === 0 ? { resolved: builder } : { problems }
}
