import type * as Abi from "ox/Abi"
import type * as Hex from "ox/Hex"
import type * as TypedData from "ox/TypedData"

// The policy values `Policy.*` builds: plain, serializable descriptions of what a session allows or limits. They
// keep what the caller wrote; `Session.from` checks and resolves them, and the compiler turns them into Smart Sessions'
// actions and policies.

/**
 * A condition on one value: equal to it, one of a list, or a bound.
 */
export type Condition<T> =
  | T
  | ReadonlyArray<T>
  | { readonly lt: T }
  | { readonly lte: T }
  | { readonly gt: T }
  | { readonly gte: T }
  | { readonly between: readonly [T, T] }

/**
 * A condition that only compares for equality: equal to the value, or one of a list.
 */
export type Equality<T> = T | ReadonlyArray<T>

/**
 * How long a limit's budget lasts before it starts again. Periods are aligned to the Unix epoch; a month is 30 days.
 */
export type Period = "hour" | "day" | "week" | "month" | "lifetime" | { readonly seconds: number }

export interface FunctionPolicy {
  readonly type: "function"
  readonly address: Hex.Hex
  readonly abi: Abi.Abi | ReadonlyArray<unknown>
  readonly functionName: string
  readonly args?: { readonly [name: string]: unknown } | undefined
  readonly value?: Condition<bigint> | undefined
}

export interface Erc20TransferPolicy {
  readonly type: "erc20Transfer"
  readonly token: Hex.Hex
  readonly to?: Equality<Hex.Hex> | undefined
  readonly amount?: Condition<bigint> | undefined
}

export interface Erc20ApprovePolicy {
  readonly type: "erc20Approve"
  readonly token: Hex.Hex
  readonly spender?: Equality<Hex.Hex> | undefined
  readonly amount?: Condition<bigint> | undefined
}

export interface NativeTransferPolicy {
  readonly type: "nativeTransfer"
  readonly to: Equality<Hex.Hex>
  readonly value?: Condition<bigint> | undefined
}

export interface CallPolicy {
  readonly type: "call"
  readonly to: Hex.Hex
  readonly selector: Hex.Hex
  readonly value?: Condition<bigint> | undefined
}

export interface AnyCallPolicy {
  readonly type: "anyCall"
  readonly unsafe: true
}

export interface SpendPolicy {
  readonly type: "spend"
  readonly token: Hex.Hex
  readonly amount: bigint
  readonly period: Period
}

export interface ValuePolicy {
  readonly type: "value"
  readonly amount: bigint
  readonly period: Period
}

export interface RateLimitPolicy {
  readonly type: "rateLimit"
  readonly count: number
  readonly period: Period
}

export interface GasPolicy {
  readonly type: "gas"
  readonly maxCost: bigint
  readonly period: Period
}

export interface ApprovalsPolicy {
  readonly type: "approvals"
  readonly tokens: ReadonlyArray<Hex.Hex>
  readonly spenders: ReadonlyArray<Hex.Hex>
  /** One cap for every token, or a cap per token (each listed token needs one). */
  readonly maxAmount: bigint | { readonly [token: string]: bigint }
}

export interface SignTypedDataPolicy {
  readonly type: "signTypedData"
  readonly domain: TypedData.Domain
  readonly types: { readonly [name: string]: ReadonlyArray<{ readonly name: string; readonly type: string }> }
  readonly primaryType: string
  readonly message?: { readonly [field: string]: unknown } | undefined
}

export interface SignMessagePolicy {
  readonly type: "signMessage"
  readonly prefix?: string | undefined
}

export interface ExecutionPolicy {
  readonly type: "execution"
  readonly address: Hex.Hex
  readonly initData: Hex.Hex
}

export type CustomPolicy =
  | {
    readonly type: "custom"
    readonly kind: "call"
    readonly address: Hex.Hex
    readonly initData: Hex.Hex
    readonly to: Hex.Hex
    readonly selector: Hex.Hex
  }
  | {
    readonly type: "custom"
    readonly kind: "limit" | "signature"
    readonly address: Hex.Hex
    readonly initData: Hex.Hex
  }

/**
 * Every policy value.
 */
export type Policy =
  | FunctionPolicy
  | Erc20TransferPolicy
  | Erc20ApprovePolicy
  | NativeTransferPolicy
  | CallPolicy
  | AnyCallPolicy
  | SpendPolicy
  | ValuePolicy
  | RateLimitPolicy
  | GasPolicy
  | ApprovalsPolicy
  | SignTypedDataPolicy
  | SignMessagePolicy
  | ExecutionPolicy
  | CustomPolicy

/**
 * A period's length in seconds, as the limit policies read it: 0 for the lifetime.
 *
 * @internal
 */
export const periodSeconds = (period: Period): number => {
  switch (period) {
    case "hour":
      return 3600
    case "day":
      return 86400
    case "week":
      return 604800
    case "month":
      return 2592000
    case "lifetime":
      return 0
    default:
      return period.seconds
  }
}
