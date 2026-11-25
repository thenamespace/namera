import * as AbiParameters from "ox/AbiParameters"
import * as Hash from "ox/Hash"
import * as Hex from "ox/Hex"

import { validatorData } from "../sessionKey.ts"
import type { CallRule, Resolved } from "./resolve.ts"
import { PERMIT2, resolve, selectors } from "./resolve.ts"
import type { Session } from "./session.ts"

// The compiler: a session to Smart Sessions' `Session` struct (contracts/src/smart-sessions/DataTypes.sol), with each
// policy's init data encoded as its contract decodes it.

/**
 * The contracts a compiled session names: Smart Sessions, the session validators, SessionHook and the policies.
 */
export interface Contracts {
  readonly smartSession: Hex.Hex
  readonly ecdsaSessionValidator: Hex.Hex
  readonly webAuthnValidator: Hex.Hex
  readonly sessionHook: Hex.Hex
  readonly allowPolicy: Hex.Hex
  readonly argPolicy: Hex.Hex
  readonly spendPolicy: Hex.Hex
  readonly valuePolicy: Hex.Hex
  readonly rateLimitPolicy: Hex.Hex
  readonly gasPolicy: Hex.Hex
  readonly approvalPolicy: Hex.Hex
  readonly signaturePolicy: Hex.Hex
}

/** A policy contract and its init data. */
export interface PolicyData {
  readonly policy: Hex.Hex
  readonly initData: Hex.Hex
}

/** A call (target and selector) and its policies. */
export interface ActionData {
  readonly actionTargetSelector: Hex.Hex
  readonly actionTarget: Hex.Hex
  readonly actionPolicies: ReadonlyArray<PolicyData>
}

/**
 * Smart Sessions' `Session` struct, with the field names of its ABI.
 */
export interface Compiled {
  readonly sessionValidator: Hex.Hex
  readonly sessionValidatorInitData: Hex.Hex
  readonly salt: Hex.Hex
  readonly userOpPolicies: ReadonlyArray<PolicyData>
  readonly erc7739Policies: {
    readonly allowedERC7739Content: ReadonlyArray<
      { readonly appDomainSeparator: Hex.Hex; readonly contentNames: ReadonlyArray<string> }
    >
    readonly erc1271Policies: ReadonlyArray<PolicyData>
  }
  readonly actions: ReadonlyArray<ActionData>
  readonly permitERC4337Paymaster: boolean
  readonly validAfter: number
  readonly validUntil: number
}

/**
 * Smart Sessions' fallback action: the policies of any call without an action of its own (never the account itself,
 * nor Smart Sessions).
 *
 * @internal
 */
export const FALLBACK = { target: "0x0000000000000000000000000000000000000001", selector: "0x00000001" } as const

const rules = AbiParameters.from(["(uint8 condition, uint256 offset, bytes32[] refs)[]"])
const limits = AbiParameters.from(["(address token, uint256 amount, uint256 period, bool countApprovals)[]"])
const amountAndPeriod = AbiParameters.from(["uint256", "uint256"])
const approvals = AbiParameters.from(["address[] spenders", "(address token, uint256 maxAmount)[] caps"])
const signatureConfig = AbiParameters.from(["(address[] verifiers, bytes[] types)"])
const typedData = AbiParameters.from([
  "(bytes32 appDomainSeparator, bytes32 typeHash, (uint8 condition, uint256 index, bytes32[] refs)[] fields)"
])
const executionPolicies = AbiParameters.from(["(address policy, bytes initData)[]"])
const permissionIdParameters = AbiParameters.from(["address", "bytes", "bytes32"])

// `Lte`, `Gt`, `Gte` and `Between` (Conditions.sol).
const LTE = 3
const LOWER_BOUNDS: ReadonlyArray<number> = [4, 5, 6]

/**
 * `ArgPolicy` rules for a call. `ArgPolicy` compares whole words, so a lower bound on an integer narrower than 256 bits
 * also gets a range rule: a word with bits above the type passes the bound, and a contract that ignores them (an older
 * compiler or language) reads a smaller number.
 */
const encodeRules = (callRules: ReadonlyArray<CallRule>): Hex.Hex =>
  AbiParameters.encode(rules, [
    callRules.flatMap((rule) => {
      const encoded = { condition: rule.comparison.operator, offset: rule.offset, refs: rule.comparison.refs }
      const { word } = rule
      if (word.type !== "uint" || word.bits >= 256 || !LOWER_BOUNDS.includes(rule.comparison.operator)) {
        return [encoded]
      }
      const max = Hex.fromNumber(BigInt(2) ** BigInt(word.bits) - BigInt(1), { size: 32 })
      return [encoded, { condition: LTE, offset: rule.offset, refs: [max] }]
    })
  ])

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/**
 * The validator that checks a session key, by its type.
 *
 * @internal
 */
export const sessionValidator = (session: Session, contracts: Contracts): Hex.Hex =>
  session.signer.type === "ecdsa" ? contracts.ecdsaSessionValidator : contracts.webAuthnValidator

/**
 * The session's permission id, as Smart Sessions computes it:
 * `keccak256(abi.encode(sessionValidator, sessionValidatorInitData, salt))`.
 *
 * @internal
 */
export const permissionId = (session: Session, contracts: Contracts): Hex.Hex =>
  Hash.keccak256(
    AbiParameters.encode(permissionIdParameters, [
      sessionValidator(session, contracts),
      validatorData(session.signer),
      session.salt
    ])
  )

const actionsOf = (resolved: Resolved, contracts: Contracts): ReadonlyArray<ActionData> => {
  const approval = resolved.approvals[0]
  const approvalPolicy = approval === undefined ? undefined : {
    policy: contracts.approvalPolicy,
    initData: AbiParameters.encode(approvals, [
      approval.spenders,
      approval.tokens.map((token, index) => ({ token, maxAmount: approval.caps[index]! }))
    ])
  }
  const governed = (target: string, selector: string) =>
    approval !== undefined
    && ((approval.tokens.some((token) => same(token, target))
      && (selector === selectors.approve || selector === selectors.increaseAllowance))
      || (same(target, PERMIT2) && selector === selectors.permit2Approve))

  // One action per target and selector; policies on the same one all apply.
  const byId = new Map<
    string,
    { target: Hex.Hex; selector: Hex.Hex; rules: Array<CallRule>; extra: Array<PolicyData> }
  >()
  const entry = (target: Hex.Hex, selector: Hex.Hex) => {
    const id = `${target.toLowerCase()}:${selector}`
    const existing = byId.get(id)
    if (existing !== undefined) return existing
    const created = { target, selector, rules: [] as Array<CallRule>, extra: [] as Array<PolicyData> }
    byId.set(id, created)
    return created
  }
  for (const action of resolved.actions) {
    const entered = entry(action.target, action.selector)
    entered.rules.push(...action.rules)
    if (action.custom !== undefined) {
      entered.extra.push({ policy: action.custom.address, initData: action.custom.initData })
    }
  }
  // With any call allowed, approvals still need ApprovalPolicy: an action of their own, which takes precedence over
  // the fallback.
  if (approval !== undefined && resolved.anyCall.length > 0) {
    for (const token of approval.tokens) {
      entry(token, selectors.approve)
      entry(token, selectors.increaseAllowance)
    }
    entry(PERMIT2, selectors.permit2Approve)
  }

  const actions: Array<ActionData> = []
  for (const { target, selector, rules: actionRules, extra } of byId.values()) {
    const policies: Array<PolicyData> = [...extra]
    if (actionRules.length > 0) policies.push({ policy: contracts.argPolicy, initData: encodeRules(actionRules) })
    if (approvalPolicy !== undefined && governed(target, selector)) policies.push(approvalPolicy)
    if (policies.length === 0) policies.push({ policy: contracts.allowPolicy, initData: "0x" })
    actions.push({ actionTargetSelector: selector, actionTarget: target, actionPolicies: policies })
  }
  if (resolved.anyCall.length > 0) {
    actions.push({
      actionTargetSelector: FALLBACK.selector,
      actionTarget: FALLBACK.target,
      actionPolicies: [{ policy: contracts.allowPolicy, initData: "0x" }]
    })
  }
  return actions.sort((a, b) =>
    a.actionTarget.toLowerCase() === b.actionTarget.toLowerCase()
      ? (a.actionTargetSelector < b.actionTargetSelector ? -1 : 1)
      : (a.actionTarget.toLowerCase() < b.actionTarget.toLowerCase() ? -1 : 1)
  )
}

const userOpPoliciesOf = (resolved: Resolved, contracts: Contracts): ReadonlyArray<PolicyData> => {
  const policies: Array<PolicyData> = []
  if (resolved.spends.length > 0) {
    policies.push({
      policy: contracts.spendPolicy,
      initData: AbiParameters.encode(limits, [
        resolved.spends.map((spend) => ({
          token: spend.token,
          amount: spend.amount,
          period: BigInt(spend.period),
          // Approvals always count: with `Policy.approvals` capping each approval but not their total, an approve
          // then a spender's pull, repeated, would leave the budget untouched (rerun review).
          countApprovals: true
        }))
      ])
    })
  }
  const value = resolved.values[0]
  if (value !== undefined) {
    policies.push({
      policy: contracts.valuePolicy,
      initData: AbiParameters.encode(amountAndPeriod, [value.amount, BigInt(value.period)])
    })
  }
  const rateLimit = resolved.rateLimits[0]
  if (rateLimit !== undefined) {
    policies.push({
      policy: contracts.rateLimitPolicy,
      initData: AbiParameters.encode(amountAndPeriod, [BigInt(rateLimit.count), BigInt(rateLimit.period)])
    })
  }
  const gas = resolved.gas[0]
  if (gas !== undefined) {
    policies.push({
      policy: contracts.gasPolicy,
      initData: AbiParameters.encode(amountAndPeriod, [gas.maxCost, BigInt(gas.period)])
    })
  }
  if (resolved.executions.length > 0) {
    policies.push({
      policy: contracts.sessionHook,
      initData: AbiParameters.encode(executionPolicies, [
        resolved.executions.map((execution) => ({ policy: execution.address, initData: execution.initData }))
      ])
    })
  }
  for (const custom of resolved.customLimits) policies.push({ policy: custom.address, initData: custom.initData })
  return policies
}

const erc7739Of = (resolved: Resolved, contracts: Contracts): Compiled["erc7739Policies"] => {
  const contents = new Map<Hex.Hex, Set<string>>()
  for (const signature of resolved.signatures) {
    const names = contents.get(signature.domainSeparator) ?? new Set<string>()
    names.add(signature.contentsType)
    contents.set(signature.domainSeparator, names)
  }

  const erc1271Policies: Array<PolicyData> = []
  if (resolved.signatures.length > 0) {
    const verifiers = [...new Set(resolved.signatures.map((signature) => signature.verifier))]
    const types = resolved.signatures.map((signature) =>
      AbiParameters.encode(typedData, [{
        appDomainSeparator: signature.domainSeparator,
        typeHash: signature.typeHash,
        fields: signature.fields.map((field) => ({
          condition: field.comparison.operator,
          index: BigInt(field.index),
          refs: field.comparison.refs
        }))
      }])
    )
    erc1271Policies.push({
      policy: contracts.signaturePolicy,
      initData: AbiParameters.encode(signatureConfig, [{ verifiers, types }])
    })
  }
  for (const custom of resolved.customSignatures) {
    erc1271Policies.push({ policy: custom.address, initData: custom.initData })
  }

  return {
    allowedERC7739Content: [...contents.entries()].map(([appDomainSeparator, names]) => ({
      appDomainSeparator,
      contentNames: [...names].sort()
    })),
    erc1271Policies
  }
}

/**
 * Compiles a session (already built by `Session.from`) to Smart Sessions' `Session` struct.
 *
 * @internal
 */
export const compile = (session: Session, contracts: Contracts): Compiled => {
  const result = resolve(session.policies)
  // `Session.from` resolved these policies already.
  if ("problems" in result) throw new Error(result.problems.map((entry) => entry.message).join("; "))
  const resolved = result.resolved
  return {
    sessionValidator: sessionValidator(session, contracts),
    sessionValidatorInitData: validatorData(session.signer),
    salt: session.salt,
    userOpPolicies: userOpPoliciesOf(resolved, contracts),
    erc7739Policies: erc7739Of(resolved, contracts),
    actions: actionsOf(resolved, contracts),
    permitERC4337Paymaster: session.sponsored,
    validAfter: session.validAfter,
    validUntil: session.validUntil === "never" ? 0 : session.validUntil
  }
}
