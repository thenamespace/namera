/**
 * Policies: everything a session allows or limits. Call policies say what the agent may call, limit policies how
 * much and how often, signing policies what it may sign, and execution policies check each operation around its
 * calls.
 *
 * **Details**
 *
 * Three rules hold for every session:
 *
 * - Deny by default: the agent may only make calls a call policy allows.
 * - Every policy must pass: a call must be allowed and every limit must still have room.
 * - Limits apply to everything they are about: `Policy.spend({ token })` counts every transfer and approval of that
 *   token in the session.
 *
 * Each builder returns a plain value; `Session.from` checks it and `Session` compiles it to Namera's policy contracts.
 *
 * @stability experimental
 * @since 2.0.0
 */
import type * as Abi from "ox/Abi"
import type * as AbiFunction from "ox/AbiFunction"
import type * as AbiParameter from "ox/AbiParameter"

import type * as internal from "./internal/core/session/policy.ts"

/**
 * A condition on a value: the value itself (equal), a list (one of), or one bound: `{ lt }`, `{ lte }`, `{ gt }`,
 * `{ gte }` or `{ between: [low, high] }`. Bounds compare unsigned integers only.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Condition<T> = internal.Condition<T>

/**
 * A condition comparing for equality: the value itself, or a list of allowed values.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Equality<T> = internal.Equality<T>

/**
 * How long a limit's budget lasts before it starts again: `"hour"`, `"day"` (a UTC day), `"week"`, `"month"` (30
 * days), `"lifetime"` (never resets) or `{ seconds }`. Periods are aligned to the Unix epoch.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Period = internal.Period

/**
 * Any policy.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Policy = internal.Policy

/**
 * The conditions an ABI parameter takes: equality for addresses, booleans and `bytesN`, any condition for unsigned
 * integers, conditions on the fields of a struct. Dynamic and signed parameters take none.
 *
 * @stability experimental
 * @category utility types
 * @since 2.0.0
 */
export type ConditionOf<parameter> = parameter extends
  { readonly type: "tuple"; readonly components: infer components extends ReadonlyArray<AbiParameter.AbiParameter> }
  ? ArgumentConditions<components>
  : parameter extends { readonly type: "address" } ? Equality<`0x${string}`>
  : parameter extends { readonly type: "bool" } ? Equality<boolean>
  : parameter extends { readonly type: `uint${string}` } ? parameter extends { readonly type: `${string}]` } ? never
    : Condition<bigint>
  : parameter extends { readonly type: `bytes${infer size}` } ? size extends "" ? never
    : size extends `${string}]` ? never
    : Equality<`0x${string}`>
  : never

/**
 * The conditions a function's arguments take, by argument name; an argument left out may be anything.
 *
 * @stability experimental
 * @category utility types
 * @since 2.0.0
 */
export type ArgumentConditions<parameters extends ReadonlyArray<AbiParameter.AbiParameter>> = {
  readonly [
    parameter in parameters[number] as parameter["name"] extends `${infer name}` ? name extends "" ? never : name
      : never
  ]?: ConditionOf<parameter>
}

/**
 * The names `Policy.function` takes for `abi`: its functions' names, or a full signature (for an overloaded one);
 * any string for an ABI that isn't `const`.
 *
 * @stability experimental
 * @category utility types
 * @since 2.0.0
 */
export type FunctionName<abi> = abi extends Abi.Abi ? AbiFunction.ExtractNames<abi> | `${string}(${string})` : string

/**
 * The argument conditions of `functionName` in `abi`: typed from a `const` ABI, any object otherwise.
 *
 * @stability experimental
 * @category utility types
 * @since 2.0.0
 */
export type ArgsOf<abi, functionName extends string> = abi extends Abi.Abi
  ? functionName extends AbiFunction.ExtractNames<abi>
    ? ArgumentConditions<AbiFunction.FromAbi<abi, functionName>["inputs"]>
  : { readonly [name: string]: unknown }
  : { readonly [name: string]: unknown }

const fn = <const abi extends Abi.Abi | ReadonlyArray<unknown>, functionName extends FunctionName<abi>>(
  options: function_.Options<abi, functionName>
): internal.FunctionPolicy => ({ type: "function", ...options })

export {
  /**
   * Allows calling one function of a contract, viem-style `{ address, abi, functionName }`, with conditions on its
   * arguments (`args`, inferred from the ABI) and on the value sent (`value`).
   *
   * **Details**
   *
   * Conditions apply to static arguments and to the fields of static structs: what `ArgPolicy` reads at a fixed
   * offset. An overloaded function is named by its signature, such as `"transfer(address,uint256)"`.
   *
   * **Example** (Swapping at most 50 USDC, for the owner)
   *
   * ```ts import.meta.vitest
   * import { Policy } from "@namera-ai/sdk"
   *
   * const abi = [{
   *   type: "function",
   *   name: "swap",
   *   stateMutability: "nonpayable",
   *   inputs: [{ name: "recipient", type: "address" }, { name: "amountIn", type: "uint256" }],
   *   outputs: []
   * }] as const
   *
   * const policy = Policy.function({
   *   address: "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD",
   *   abi,
   *   functionName: "swap",
   *   args: { recipient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", amountIn: { lte: 50_000000n } }
   * })
   *
   * policy.type // => "function"
   * ```
   *
   * @stability experimental
   * @category constructors
   * @since 2.0.0
   */
  fn as function
}

/**
 * Types of `Policy.function`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace function_ {
  /**
   * The contract, its ABI, the function, and conditions on its arguments and value.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options<abi extends Abi.Abi | ReadonlyArray<unknown>, functionName extends string> {
    readonly address: `0x${string}`
    readonly abi: abi
    readonly functionName: functionName
    readonly args?: ArgsOf<abi, functionName> | undefined
    readonly value?: Condition<bigint> | undefined
  }
}

/**
 * Allows ERC-20 `transfer(to, amount)` of a token, with conditions on the recipient and the amount.
 *
 * **Example** (Paying one merchant at most 50 USDC per transfer)
 *
 * ```ts import.meta.vitest
 * import { Policy } from "@namera-ai/sdk"
 *
 * const policy = Policy.erc20Transfer({
 *   token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
 *   to: ["0x70997970C51812dc3A010C7d01b50e0d17dc79C8"],
 *   amount: { lte: 50_000000n }
 * })
 *
 * policy.type // => "erc20Transfer"
 * ```
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const erc20Transfer = (options: erc20Transfer.Options): internal.Erc20TransferPolicy => ({
  type: "erc20Transfer",
  ...options
})

/**
 * Types of `Policy.erc20Transfer`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace erc20Transfer {
  /**
   * The token, and conditions on the recipient (`to`) and the `amount`.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options {
    readonly token: `0x${string}`
    readonly to?: Equality<`0x${string}`> | undefined
    readonly amount?: Condition<bigint> | undefined
  }
}

/**
 * Allows ERC-20 `approve(spender, amount)` of a token, with conditions on the spender and the amount.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const erc20Approve = (options: erc20Approve.Options): internal.Erc20ApprovePolicy => ({
  type: "erc20Approve",
  ...options
})

/**
 * Types of `Policy.erc20Approve`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace erc20Approve {
  /**
   * The token, and conditions on the `spender` and the `amount`.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options {
    readonly token: `0x${string}`
    readonly spender?: Equality<`0x${string}`> | undefined
    readonly amount?: Condition<bigint> | undefined
  }
}

/**
 * Allows sending native currency, without calldata, to the listed addresses, with a condition on the value.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const nativeTransfer = (options: nativeTransfer.Options): internal.NativeTransferPolicy => ({
  type: "nativeTransfer",
  ...options
})

/**
 * Types of `Policy.nativeTransfer`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace nativeTransfer {
  /**
   * The recipients, and a condition on the `value` sent.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options {
    readonly to: Equality<`0x${string}`>
    readonly value?: Condition<bigint> | undefined
  }
}

/**
 * Allows calling a function by its selector with any arguments. `Session.validate` warns: prefer `Policy.function`.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const call = (options: call.Options): internal.CallPolicy => ({ type: "call", ...options })

/**
 * Types of `Policy.call`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace call {
  /**
   * The contract, the 4-byte selector, and a condition on the value sent.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options {
    readonly to: `0x${string}`
    readonly selector: `0x${string}`
    readonly value?: Condition<bigint> | undefined
  }
}

/**
 * Allows any call to any contract except the account's own infrastructure: the account itself, Smart Sessions, the
 * EntryPoint, and the validators, executors and hooks the account has installed (a call there could replace its
 * owner); those need an explicit policy. Needs `unsafe: true`; `Session.validate` warns.
 *
 * **Details**
 *
 * It also refuses any module lifecycle or hook function (`onInstall`, `onUninstall`, `preCheck`, `postCheck`), and
 * calldata ending in the account's address, which ERC-2771 contracts read as the account calling itself. A call whose
 * last argument is the account, such as a vault deposit with the account as `receiver`, needs an explicit policy.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const anyCall = (options: { readonly unsafe: true }): internal.AnyCallPolicy => ({
  type: "anyCall",
  unsafe: options.unsafe
})

/**
 * Limits how much of an ERC-20 token the session may spend per period: transfers and approvals (an approval lets a
 * spender pull the tokens later, which the policy doesn't see).
 *
 * **Details**
 *
 * The amount requested counts, so fee-on-transfer and rebasing tokens count what was asked. A token may have one
 * limit per period, such as a daily budget and a lifetime one.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const spend = (options: spend.Options): internal.SpendPolicy => ({ type: "spend", ...options })

/**
 * Types of `Policy.spend`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace spend {
  /**
   * The token, the most it may spend, and per which period.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options {
    readonly token: `0x${string}`
    readonly amount: bigint
    readonly period: Period
  }
}

/**
 * Limits how much native currency the session may send per period, across all calls.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const value = (options: value.Options): internal.ValuePolicy => ({ type: "value", ...options })

/**
 * Types of `Policy.value`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace value {
  /**
   * The most it may send, in wei, and per which period.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options {
    readonly amount: bigint
    readonly period: Period
  }
}

/**
 * Limits how many user operations the session may send per period.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const rateLimit = (options: rateLimit.Options): internal.RateLimitPolicy => ({ type: "rateLimit", ...options })

/**
 * Types of `Policy.rateLimit`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace rateLimit {
  /**
   * How many operations, and per which period.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options {
    readonly count: number
    readonly period: Period
  }
}

/**
 * Limits the gas the session may spend per period, counted at its worst case (`maxFeePerGas` × every gas limit),
 * sponsored operations included. Every session needs one (`Session.validate` reports `GAS_LIMIT_REQUIRED`): the agent
 * sets each operation's fees, and without a paymaster the account pays them.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const gas = (options: gas.Options): internal.GasPolicy => ({ type: "gas", ...options })

/**
 * Types of `Policy.gas`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace gas {
  /**
   * The most it may cost, in wei, and per which period.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options {
    readonly maxCost: bigint
    readonly period: Period
  }
}

/**
 * Limits ERC-20 `approve` of the listed tokens, and Permit2 approvals of them, to the listed spenders and at most
 * `maxAmount` each: one cap for every token, or a cap per token (`{ [token]: amount }`) for tokens with different
 * decimals. Revoking (amount 0) is always allowed; `increaseAllowance` is refused, since repeated calls would add up
 * past the cap.
 *
 * **Details**
 *
 * It limits approvals other policies allow (`Policy.erc20Approve`, `Policy.call`, `Policy.anyCall`); it allows
 * nothing by itself; `Policy.spend` still counts the approvals it allows. List ERC-20 tokens only: an
 * ERC-721's `approve(spender, tokenId)` has the same selector.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const approvals = (options: approvals.Options): internal.ApprovalsPolicy => ({ type: "approvals", ...options })

/**
 * Types of `Policy.approvals`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace approvals {
  /**
   * The tokens, the spenders they may be approved to, and the most each approval may be for.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options {
    readonly tokens: ReadonlyArray<`0x${string}`>
    readonly spenders: ReadonlyArray<`0x${string}`>
    readonly maxAmount: bigint | { readonly [token: `0x${string}`]: bigint }
  }
}

/**
 * Allows signing EIP-712 typed data of one type for one app domain, through the account's ERC-1271 (ERC-7739
 * `TypedDataSign`), with conditions on the message's fields enforced on chain.
 *
 * **Details**
 *
 * The domain needs a `verifyingContract`. Field conditions apply to atomic fields (`address`, `uintN`, `bool`,
 * `bytesN`; `string` and `bytes` compare for equality, by hash). Session signatures always carry the typed data, so
 * `SignaturePolicy` reads the fields that were signed.
 *
 * **Example** (A USDC permit to one spender, for at most 5 USDC)
 *
 * ```ts import.meta.vitest
 * import { Policy } from "@namera-ai/sdk"
 *
 * const policy = Policy.signTypedData({
 *   domain: { name: "USD Coin", version: "2", chainId: 8453, verifyingContract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
 *   types: {
 *     Permit: [
 *       { name: "owner", type: "address" },
 *       { name: "spender", type: "address" },
 *       { name: "value", type: "uint256" },
 *       { name: "nonce", type: "uint256" },
 *       { name: "deadline", type: "uint256" }
 *     ]
 *   },
 *   primaryType: "Permit",
 *   message: { spender: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", value: { lte: 5_000000n } }
 * })
 *
 * policy.primaryType // => "Permit"
 * ```
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const signTypedData = (options: signTypedData.Options): internal.SignTypedDataPolicy => ({
  type: "signTypedData",
  ...options
})

/**
 * Types of `Policy.signTypedData`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace signTypedData {
  /**
   * The app's EIP-712 domain, its types, the primary type it may sign, and conditions on the message's fields.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options {
    readonly domain: internal.SignTypedDataPolicy["domain"]
    readonly types: internal.SignTypedDataPolicy["types"]
    readonly primaryType: string
    readonly message?: { readonly [field: string]: unknown } | undefined
  }
}

/**
 * Signing personal messages. Smart Sessions supports only ERC-7739's `TypedDataSign`, so `Session.validate`
 * refuses a session with this policy (`SIGN_MESSAGE_UNSUPPORTED`).
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const signMessage = (options?: { readonly prefix?: string | undefined }): internal.SignMessagePolicy => ({
  type: "signMessage",
  ...options
})

/**
 * Checks every operation of the session with an execution policy: a contract implementing `IExecutionPolicy`,
 * run by SessionHook before and after the operation's calls.
 *
 * **Details**
 *
 * A session takes at most 8. It also needs `Policy.rateLimit` and `Policy.gas`, since an operation an execution
 * policy rejects is still included, and its gas paid.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const execution = (options: execution.Options): internal.ExecutionPolicy => ({ type: "execution", ...options })

/**
 * Types of `Policy.execution`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace execution {
  /**
   * The execution policy contract, and its configuration for this session.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options {
    readonly address: `0x${string}`
    readonly initData: `0x${string}`
  }
}

/**
 * Any policy contract implementing Smart Sessions' `IPolicy`: an action policy that allows calling `selector` on
 * `to` (`kind: "call"`), a user operation policy (`"limit"`), or an ERC-1271 policy (`"signature"`).
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const custom = (options: custom.Options): internal.CustomPolicy => ({ type: "custom", ...options })

/**
 * Types of `Policy.custom`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace custom {
  /**
   * The policy contract, its configuration, its kind, and for a call policy the call it allows.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type Options =
    | {
      readonly kind: "call"
      readonly address: `0x${string}`
      readonly initData: `0x${string}`
      readonly to: `0x${string}`
      readonly selector: `0x${string}`
    }
    | { readonly kind: "limit" | "signature"; readonly address: `0x${string}`; readonly initData: `0x${string}` }
}
