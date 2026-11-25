import * as AbiParameters from "ox/AbiParameters"
import * as Hex from "ox/Hex"

import type { DecodedCall } from "../agent/calls.ts"
import { type Compiled, type Contracts, FALLBACK, type PolicyData } from "../session/compile.ts"
import { PERMIT2, VALUE_OFFSET, VALUE_SELECTOR } from "../session/resolve.ts"
import { amountAndPeriod, counterKey, limits, resetsAt, tags, tokenTag } from "./usage.ts"
import type { Violation } from "./violation.ts"

// The policy evaluator: what Smart Sessions and Namera's policies would decide about a session operation, from the
// compiled session (each policy's init data decoded as its contract decodes it), the calls and what the limits have
// used. It mirrors the contracts so an agent can refuse before signing; the contracts still decide. Custom policies
// and execution policies can't be evaluated here and are left to the chain.

/** `execute(bytes32,bytes)`, which a session may not call on the account itself. */
const EXECUTE = "0xe9ae5c53"
const MAX = BigInt(2) ** BigInt(256) - BigInt(1)
const UINT160 = (BigInt(1) << BigInt(160)) - BigInt(1)
/** EntryPoint v0.7, Kernel 3.3's. */
const ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032"

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/**
 * What the evaluator knows about a session operation.
 *
 * @internal
 */
export interface Operation {
  readonly calls: ReadonlyArray<DecodedCall>
  /** Whether a paymaster pays: Smart Sessions then needs the session to allow it. */
  readonly sponsored: boolean
  /** `GasPolicy`'s worst-case cost, when the operation's gas is known. */
  readonly gasCost?: bigint | undefined
}

/**
 * The chain's state the evaluator reads: the time (the agent's stated time for limits, the block's for the window),
 * whether the session is enabled, whether its grant can still enable it, and what each limit has used in the current
 * period (by `counterKey`).
 *
 * @internal
 */
export interface State {
  readonly time: bigint
  readonly enabled: boolean
  readonly revoked: boolean
  readonly usage: ReadonlyMap<string, bigint>
}

/** The window Smart Sessions checks, inclusive at both ends as the EntryPoint is; `validUntil` 0 is unbounded. */
export const windowViolations = (
  compiled: Compiled,
  state: Pick<State, "time" | "enabled" | "revoked">
): ReadonlyArray<Violation> => {
  if (!state.enabled && state.revoked) return [{ _tag: "SessionRevoked" }]
  if (state.time < BigInt(compiled.validAfter)) return [{ _tag: "SessionNotYetValid", validAfter: compiled.validAfter }]
  if (compiled.validUntil !== 0 && state.time > BigInt(compiled.validUntil)) {
    return [{ _tag: "SessionExpired", validUntil: compiled.validUntil }]
  }
  return []
}

const word = (data: Hex.Hex, offset: number): bigint | undefined =>
  Hex.size(data) < offset + 32 ? undefined : Hex.toBigInt(Hex.slice(data, offset, offset + 32))

/** `Conditions.holds`: one reference for a comparison, an inclusive range for `Between`, membership for `OneOf`. */
export const holds = (condition: number, refs: ReadonlyArray<Hex.Hex>, x: bigint): boolean => {
  if (condition === 7) return refs.some((ref) => Hex.toBigInt(ref) === x)
  const ref = Hex.toBigInt(refs[0]!)
  switch (condition) {
    case 0:
      return x === ref
    case 1:
      return x !== ref
    case 2:
      return x < ref
    case 3:
      return x <= ref
    case 4:
      return x > ref
    case 5:
      return x >= ref
    default:
      return ref <= x && x <= Hex.toBigInt(refs[1]!)
  }
}

const rules = AbiParameters.from(["(uint8 condition, uint256 offset, bytes32[] refs)[]"])
const approvalConfig = AbiParameters.from(["address[] spenders", "(address token, uint256 maxAmount)[] caps"])

/** `ArgPolicy.checkAction`: every rule holds on its argument word, or on the value. */
const argumentsHold = (initData: Hex.Hex, call: DecodedCall): boolean => {
  const [entries] = AbiParameters.decode(rules, initData)
  return entries.every((rule) => {
    const x = rule.offset === VALUE_OFFSET ? call.value : word(call.data, 4 + Number(rule.offset))
    return x !== undefined && holds(rule.condition, rule.refs, x)
  })
}

/**
 * `ApprovalPolicy.checkAction`: `approve` on a listed token, or Permit2's `approve` of one, without value, to a listed
 * spender up to the token's cap, or a revocation. `increaseAllowance` and anything else fail.
 */
const approvalHolds = (initData: Hex.Hex, call: DecodedCall): boolean => {
  const [spenders, caps] = AbiParameters.decode(approvalConfig, initData)
  const data = call.data.toLowerCase() as Hex.Hex
  if (call.value !== BigInt(0) || Hex.size(data) < 4) return false
  const selector = Hex.slice(data, 0, 4)
  let token: Hex.Hex
  let spender: Hex.Hex
  let amount: bigint
  if (selector === "0x095ea7b3") {
    if (Hex.size(data) < 68) return false
    token = call.to
    spender = Hex.slice(data, 16, 36)
    amount = word(data, 36)!
  } else if (selector === "0x87517c45" && same(call.to, PERMIT2)) {
    if (Hex.size(data) < 132) return false
    token = Hex.slice(data, 16, 36)
    spender = Hex.slice(data, 48, 68)
    amount = word(data, 68)! & UINT160
  } else {
    return false
  }
  const cap = caps.find((entry) => same(entry.token, token))
  if (cap === undefined) return false
  if (amount === BigInt(0)) return true
  return amount <= cap.maxAmount && spenders.some((entry) => same(entry, spender))
}

const actionViolations = (
  policies: ReadonlyArray<PolicyData>,
  contracts: Contracts,
  call: DecodedCall,
  where: { readonly call: number; readonly to: Hex.Hex; readonly selector: Hex.Hex }
): ReadonlyArray<Violation> =>
  policies.flatMap(({ initData, policy }): ReadonlyArray<Violation> => {
    if (same(policy, contracts.argPolicy) && !argumentsHold(initData, call)) {
      return [{ _tag: "ArgumentRejected", ...where, policy: "arguments" }]
    }
    if (same(policy, contracts.approvalPolicy) && !approvalHolds(initData, call)) {
      return [{ _tag: "ArgumentRejected", ...where, policy: "approvals" }]
    }
    return []
  })

/**
 * `PolicyLib.checkSingle7579Exec` for each call: the call's own action (target and selector), else the fallback
 * action, never the fallback for a call on the account itself or the EntryPoint, a module lifecycle or hook function, or
 * calldata ending in the account's or the EntryPoint's address (`PolicyLib._reachesAccount`; the account's installed modules are refused
 * on chain too, which an offline check can't see); no nested `execute` on the account, no call to Smart Sessions or
 * the fallback's marker target, and no calldata of 1 to 3 bytes or starting with the value selector.
 */
const callViolations = (
  compiled: Compiled,
  contracts: Contracts,
  account: Hex.Hex,
  calls: ReadonlyArray<DecodedCall>
): ReadonlyArray<Violation> =>
  calls.flatMap((call, index): ReadonlyArray<Violation> => {
    const selector = Hex.size(call.data) < 4 ? VALUE_SELECTOR : Hex.slice(call.data, 0, 4).toLowerCase() as Hex.Hex
    const where = { call: index, to: call.to, selector }
    const refused: ReadonlyArray<Violation> = [{ _tag: "CallNotAllowed", ...where }]
    const self = same(call.to, account)
    // Only empty calldata is a plain value transfer.
    const valueAlias = selector === VALUE_SELECTOR && Hex.size(call.data) !== 0
    if (
      valueAlias || (self && selector === EXECUTE) || same(call.to, FALLBACK.target)
      || same(call.to, contracts.smartSession)
    ) {
      return refused
    }
    const action = compiled.actions.find((entry) =>
      same(entry.actionTarget, call.to) && same(entry.actionTargetSelector, selector)
    )
    if (action !== undefined) return actionViolations(action.actionPolicies, contracts, call, where)
    // The fallback never reaches the EntryPoint, a module's lifecycle or hook functions, or an ERC-2771 contract with
    // the account or the EntryPoint as the sender; the account's installed modules are refused on chain too.
    const sender = Hex.size(call.data) >= 20 ? Hex.slice(call.data, -20) : undefined
    const actsAsAccount = sender !== undefined && (same(sender, account) || same(sender, ENTRY_POINT))
    if (self || same(call.to, ENTRY_POINT) || MODULE_FUNCTIONS.includes(selector) || actsAsAccount) {
      return refused
    }
    const fallback = compiled.actions.find((entry) =>
      same(entry.actionTarget, FALLBACK.target) && entry.actionTargetSelector === FALLBACK.selector
    )
    return fallback === undefined ? refused : actionViolations(fallback.actionPolicies, contracts, call, where)
  })

/**
 * What `call` spends of `token` as `SpendPolicy._spent` counts it: `transfer`, `transferFrom`, and approvals (Permit2's
 * included) when they count; any other function of the token, or a truncated amount, counts as unlimited.
 */
const spent = (call: DecodedCall, token: Hex.Hex, countApprovals: boolean): bigint => {
  const data = call.data.toLowerCase() as Hex.Hex
  const size = Hex.size(data)
  if (same(call.to, PERMIT2)) {
    if (!countApprovals || size < 4 || Hex.slice(data, 0, 4) !== "0x87517c45") return BigInt(0)
    if (size < 100) return MAX
    if (!same(Hex.slice(data, 16, 36), token)) return BigInt(0)
    return word(data, 68)! & UINT160
  }
  if (!same(call.to, token) || size === 0) return BigInt(0)
  if (size < 4) return MAX
  const selector = Hex.slice(data, 0, 4)
  const approval = selector === "0x095ea7b3" || selector === "0x39509351"
  if (approval && !countApprovals) return BigInt(0)
  const offset = selector === "0xa9059cbb" ? 36 : selector === "0x23b872dd" ? 68 : approval ? 36 : undefined
  if (offset === undefined) return MAX
  return word(data, offset) ?? MAX
}

/** `onInstall(bytes)`, `onUninstall(bytes)`, `preCheck(address,uint256,bytes)`, `postCheck(bytes)`. */
const MODULE_FUNCTIONS: ReadonlyArray<string> = ["0x6d61fe70", "0x8a91b0e3", "0xd68f6025", "0x173bf7da"]

const MAX_USED = (BigInt(1) << BigInt(208)) - BigInt(1)

/** A limit's charge: within the budget, or a violation with what is left and when it resets. */
const charge = (options: {
  readonly key: string
  readonly budget: bigint
  readonly period: bigint
  readonly amount: bigint
  readonly state: State
}) => {
  const used = options.state.usage.get(options.key) ?? BigInt(0)
  // A counter holds 208 bits of usage, so no budget leaves room past 2^208 - 1.
  const room = MAX_USED < options.budget ? MAX_USED : options.budget
  const remaining = used > room ? BigInt(0) : room - used
  return {
    exceeded: options.amount > BigInt(0) && options.amount > remaining,
    remaining,
    resetsAt: resetsAt(options.period, options.state.time)
  }
}

const limitViolations = (
  compiled: Compiled,
  contracts: Contracts,
  operation: Operation,
  state: State
): ReadonlyArray<Violation> =>
  compiled.userOpPolicies.flatMap(({ initData, policy }): ReadonlyArray<Violation> => {
    if (same(policy, contracts.spendPolicy)) {
      const [entries] = AbiParameters.decode(limits, initData, { checksumAddress: true })
      return entries.flatMap((limit): ReadonlyArray<Violation> => {
        const amount = operation.calls.reduce(
          (sum, call) => sum + spent(call, limit.token, limit.countApprovals),
          BigInt(0)
        )
        const key = counterKey({ policy, tag: tokenTag(limit.token), period: limit.period })
        const result = charge({ key, budget: limit.amount, period: limit.period, amount, state })
        if (!result.exceeded) return []
        return [{
          _tag: "SpendLimitExceeded",
          token: limit.token,
          attempted: amount,
          remaining: result.remaining,
          resetsAt: result.resetsAt
        }]
      })
    }
    const kind = same(policy, contracts.valuePolicy)
      ? "value" as const
      : same(policy, contracts.rateLimitPolicy)
      ? "rateLimit" as const
      : same(policy, contracts.gasPolicy)
      ? "gas" as const
      : undefined
    if (kind === undefined) return []
    const [budget, period] = AbiParameters.decode(amountAndPeriod, initData)
    const amount = kind === "value"
      ? operation.calls.reduce((sum, call) => sum + call.value, BigInt(0))
      : kind === "rateLimit"
      ? BigInt(1)
      : operation.gasCost
    // An operation whose gas isn't known yet (a dry run) isn't charged.
    if (amount === undefined) return []
    const result = charge({ key: counterKey({ policy, tag: tags[kind], period }), budget, period, amount, state })
    if (!result.exceeded) return []
    switch (kind) {
      case "value":
        return [{
          _tag: "ValueLimitExceeded",
          attempted: amount,
          remaining: result.remaining,
          resetsAt: result.resetsAt
        }]
      case "rateLimit":
        return [{ _tag: "RateLimited", remaining: result.remaining, resetsAt: result.resetsAt }]
      case "gas":
        return [{ _tag: "GasLimitExceeded", attempted: amount, remaining: result.remaining, resetsAt: result.resetsAt }]
    }
  })

/**
 * Every reason Smart Sessions and the session's policies would refuse the operation; none when they would accept it
 * (as far as Namera's own policies tell).
 *
 * @internal
 */
export const evaluateOperation = (options: {
  readonly compiled: Compiled
  readonly contracts: Contracts
  readonly account: Hex.Hex
  readonly operation: Operation
  readonly state: State
}): ReadonlyArray<Violation> => {
  const { account, compiled, contracts, operation, state } = options
  const window = windowViolations(compiled, state)
  if (window.length > 0) return window
  const paymaster: ReadonlyArray<Violation> =
    operation.sponsored && (!compiled.permitERC4337Paymaster || compiled.userOpPolicies.length === 0)
      ? [{ _tag: "PaymasterNotAllowed" }]
      : []
  return [
    ...paymaster,
    ...callViolations(compiled, contracts, account, operation.calls),
    ...limitViolations(compiled, contracts, operation, state)
  ]
}

/**
 * `GasPolicy.cost`: `maxFeePerGas` times every gas limit the operation sets, the paymaster's included.
 *
 * @internal
 */
export const gasCost = (operation: {
  readonly callGasLimit?: bigint | undefined
  readonly verificationGasLimit?: bigint | undefined
  readonly preVerificationGas?: bigint | undefined
  readonly paymasterVerificationGasLimit?: bigint | undefined
  readonly paymasterPostOpGasLimit?: bigint | undefined
  readonly maxFeePerGas?: bigint | undefined
  readonly paymaster?: Hex.Hex | undefined
}): bigint => {
  const zero = BigInt(0)
  const paymaster = operation.paymaster === undefined
    ? zero
    : (operation.paymasterVerificationGasLimit ?? zero) + (operation.paymasterPostOpGasLimit ?? zero)
  return ((operation.callGasLimit ?? zero) + (operation.verificationGasLimit ?? zero)
    + (operation.preVerificationGas ?? zero) + paymaster) * (operation.maxFeePerGas ?? zero)
}
