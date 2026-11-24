import * as AbiFunction from "ox/AbiFunction"
import * as AbiParameters from "ox/AbiParameters"
import * as Hash from "ox/Hash"
import * as Hex from "ox/Hex"

import type { Compiled, Contracts } from "../session/compile.ts"

// What a session has used of its limits: each limit policy counts per (configuration, tag, period), and its `usage`
// view reads a counter (contracts/src/policies/lib/LimitPolicy.sol).

/**
 * The tags the value, rate-limit and gas policies count under; a spend limit counts under its token.
 *
 * @internal
 */
export const tags = {
  value: Hash.keccak256(Hex.fromString("namera.value")),
  rateLimit: Hash.keccak256(Hex.fromString("namera.rate-limit")),
  gas: Hash.keccak256(Hex.fromString("namera.gas"))
} as const

/**
 * One counter to read: a limit policy's, for a tag and a period (seconds, 0 for the lifetime).
 *
 * @internal
 */
export interface Counter {
  readonly policy: Hex.Hex
  readonly tag: Hex.Hex
  readonly period: bigint
}

/** @internal */
export const tokenTag = (token: Hex.Hex): Hex.Hex => Hex.padLeft(token.toLowerCase() as Hex.Hex, 32)

/**
 * A key for a counter, to look its usage up.
 *
 * @internal
 */
export const counterKey = (counter: Counter): string =>
  `${counter.policy.toLowerCase()}:${counter.tag.toLowerCase()}:${counter.period}`

/** @internal */
export const limits = AbiParameters.from(["(address token, uint256 amount, uint256 period, bool countApprovals)[]"])
/** @internal */
export const amountAndPeriod = AbiParameters.from(["uint256", "uint256"])

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/**
 * One budget of a session: what it limits (a token's spending, native value, operations or gas), how much per period
 * (seconds, 0 for the lifetime), and the counter its policy keeps.
 *
 * @internal
 */
export interface Limit extends Counter {
  readonly kind: "spend" | "value" | "rateLimit" | "gas"
  readonly token?: Hex.Hex | undefined
  readonly budget: bigint
}

/**
 * Every budget the session's limit policies keep.
 *
 * @internal
 */
export const limitsOf = (compiled: Compiled, contracts: Contracts): ReadonlyArray<Limit> =>
  compiled.userOpPolicies.flatMap(({ initData, policy }): ReadonlyArray<Limit> => {
    if (same(policy, contracts.spendPolicy)) {
      const [entries] = AbiParameters.decode(limits, initData)
      return entries.map((limit) => ({
        kind: "spend",
        policy,
        token: limit.token,
        tag: tokenTag(limit.token),
        budget: limit.amount,
        period: limit.period
      }))
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
    return [{ kind, policy, tag: tags[kind], budget, period }]
  })

/**
 * Every counter the session's limit policies keep.
 *
 * @internal
 */
export const counters = (compiled: Compiled, contracts: Contracts): ReadonlyArray<Counter> =>
  limitsOf(compiled, contracts).map(({ period, policy, tag }) => ({ policy, tag, period }))

/**
 * Smart Sessions' configuration id of a session's user operation policies on an account:
 * `keccak256(account ‖ permissionId)`.
 *
 * @internal
 */
export const userOpConfigId = (account: Hex.Hex, permissionId: Hex.Hex): Hex.Hex =>
  Hash.keccak256(Hex.concat(account, permissionId))

const usage = AbiFunction.from(
  "function usage(bytes32 configId, address multiplexer, address account, bytes32 tag, uint256 period, uint256 time) view returns (uint256)"
)

/** @internal */
export const encodeUsage = (options: {
  readonly counter: Counter
  readonly account: Hex.Hex
  readonly permissionId: Hex.Hex
  readonly smartSession: Hex.Hex
  readonly time: bigint
}): Hex.Hex =>
  AbiFunction.encodeData(usage, [
    userOpConfigId(options.account, options.permissionId),
    options.smartSession,
    options.account,
    options.counter.tag,
    options.counter.period,
    options.time
  ])

/** @internal */
export const decodeUsage = (result: Hex.Hex): bigint => AbiFunction.decodeResult(usage, result)

/**
 * When the period of `period` seconds containing `time` ends: the first second of the next one. `undefined` for the
 * lifetime.
 *
 * @internal
 */
export const resetsAt = (period: bigint, time: bigint): number | undefined =>
  period === BigInt(0) ? undefined : Number((time / period + BigInt(1)) * period)
