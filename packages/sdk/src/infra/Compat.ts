/**
 * Which accounts, bundlers and paymasters work together, from Namera's live tests: `Compat.check` for one
 * combination, `Compat.matrix` for the whole table.
 *
 * **Details**
 *
 * The rules (EntryPoint 0.7, Kernel 3.3 deployed or through EIP-7702):
 *
 * | Rule | Code |
 * | --- | --- |
 * | Pimlico's and ZeroDev's sponsorship and Pimlico's ERC-20 paymaster only work through Pimlico's or ZeroDev's bundler | `PAYMASTER_BUNDLER_BOUND` |
 * | Alchemy's bundler sponsorship only through Alchemy, UltraRelay only through ZeroDev, neither with a paymaster | `SPONSORSHIP_BUNDLER_BOUND` |
 * | Etherspot's EntryPoint 0.7 endpoint rejects EIP-7702 authorizations | `EIP7702_UNSUPPORTED` |
 * | Etherspot includes operations in about 95 s | warning `SLOW_INCLUSION` |
 * | Circle's paymaster for an agent needs a session that allows its permit | `SESSION_PERMIT_REQUIRED` |
 * | The bundler, paymaster or Namera's session contracts are not on the chain | `NOT_ON_CHAIN` |
 *
 * The `Bundler.*` helpers run `Compat.check` when viem prepares each operation, and refuse a combination with
 * problems with `CompatError` before signing, unless given `strict: false`.
 *
 * @stability experimental
 * @since 2.0.0
 */
import type { SmartAccount } from "../internal/viem/smartAccount.ts"
import type * as Session from "../Session.ts"
import type * as Bundler from "./Bundler.ts"
import type * as CompatError from "./CompatError.ts"
import * as internal from "./internal/compat.ts"
import * as data from "./internal/matrix.ts"
import type * as Paymaster from "./Paymaster.ts"

/**
 * The compatibility data: per bundler its fee method, chains, EIP-7702 support and inclusion time; per paymaster
 * the bundlers and chains it works with; and the rules, each with its source and date. `version` is the date of the
 * newest evidence.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Matrix = data.Matrix

/**
 * What `Compat.check` found: `problems` that will fail, `warnings` worth knowing. `ok` is true without problems.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export interface Result {
  readonly ok: boolean
  readonly problems: ReadonlyArray<CompatError.Problem>
  readonly warnings: ReadonlyArray<CompatError.Problem>
}

/**
 * An account as the rules see it, when there is no account object: whether it is an EIP-7702 account still to be
 * delegated, and the session it acts under, for an agent.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export interface Account {
  readonly eip7702?: boolean | undefined
  readonly session?: Session.Session | undefined
}

/**
 * Checks one combination of account, bundler and paymaster on a chain, reporting every problem at once.
 *
 * **Details**
 *
 * The bundler and paymaster are a helper's result or a vendor name (`"candide"`, `"pimlico"`, or a bundler
 * sponsorship, `"alchemy-bso"` or `"ultra-relay"`, as the paymaster). The account is a Namera account (an agent's,
 * from `Grant.toAccount`, brings its session), or a description of one; without it, only the bundler and paymaster
 * are checked. A `custom` bundler (`Bundler.from`) turns the rules that depend on the bundler into warnings.
 *
 * **Example** (A paymaster bound to other bundlers)
 *
 * ```ts import.meta.vitest
 * import { Compat } from "@namera-ai/sdk"
 *
 * const result = Compat.check({ bundler: "candide", paymaster: "pimlico", chainId: 8453 })
 * result.ok // => false
 * result.problems[0]?.code // => "PAYMASTER_BUNDLER_BOUND"
 *
 * Compat.check({ bundler: "etherspot", paymaster: "circle", chainId: 8453 }).warnings[0]?.code // => "SLOW_INCLUSION"
 * ```
 *
 * @stability experimental
 * @category utils
 * @since 2.0.0
 */
export const check = (options: check.Options): Result => internal.check(options)

/**
 * Types of `Compat.check`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace check {
  /**
   * The account (optional), the bundler, the paymaster (optional) and the chain.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options {
    readonly account?: SmartAccount | Account | undefined
    readonly bundler: Bundler.Bundler | Bundler.Vendor
    readonly paymaster?: Paymaster.Paymaster | Paymaster.Vendor | Bundler.Sponsorship | undefined
    readonly chainId: number
  }
}

/**
 * The full compatibility table, for docs and UIs.
 *
 * **Example** (Where Circle's paymaster works)
 *
 * ```ts import.meta.vitest
 * import { Compat } from "@namera-ai/sdk"
 *
 * const circle = Compat.matrix().paymasters.find((entry) => entry.vendor === "circle")
 * circle?.bundlers // => "any"
 * ```
 *
 * @stability experimental
 * @category getters
 * @since 2.0.0
 */
export const matrix = (): Matrix => data.matrix
