/**
 * ZeroDev's Kernel 3.3 as a viem smart account, owned by one key with the ECDSA validator as root, and as an
 * EIP-7702 delegation of the owner's own address.
 *
 * @stability experimental
 * @since 2.0.0
 */
import type * as ChainError from "../ChainError.ts"
import { run, type RunOptions } from "../internal/promise.ts"
import type * as Account from "./Account.ts"
import type * as AccountError from "./AccountError.ts"
import * as internal from "./internal/kernel.ts"

/**
 * A Kernel account built by Namera.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type KernelAccount = Account.Account<"kernel">

/**
 * Builds a Kernel account for an owner, at its counterfactual address unless `address` is given.
 *
 * **Details**
 *
 * The address is computed offline from the owner, `index` and `sessions`; the factory deploys it in the first user
 * operation. With `sessions` (the default) that deployment also installs Smart Sessions as a validator for
 * `execute`, so an agent's first operation needs no separate owner transaction.
 *
 * **Example** (Sending a user operation from a Kernel account)
 *
 * ```ts
 * import { KernelAccount } from "@namera-ai/sdk"
 * import { createPublicClient, http, zeroAddress } from "viem"
 * import { createBundlerClient } from "viem/account-abstraction"
 * import { privateKeyToAccount } from "viem/accounts"
 * import { base } from "viem/chains"
 *
 * const client = createPublicClient({ chain: base, transport: http() })
 * const owner = privateKeyToAccount("0x0123456789012345678901234567890123456789012345678901234567890123")
 * const account = await KernelAccount.from({ client, owner })
 *
 * const bundler = createBundlerClient({ account, client, transport: http("https://bundler.example") })
 * await bundler.sendUserOperation({ calls: [{ to: zeroAddress, value: 1n }] })
 * ```
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export function from(options: from.Options): Promise<from.ReturnType> {
  return run(internal.from(options), options)
}

/**
 * Types of `KernelAccount.from`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace from {
  /**
   * The client (with a chain), the owner, and optionally the `version` (`"3.3"`), `index` (the counterfactual salt,
   * `0n`), an existing `address`, and `sessions` (install Smart Sessions at deploy, `true`).
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends internal.FromOptions, RunOptions {}
  /**
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ReturnType = KernelAccount
  /**
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = AccountError.AccountError | ChainError.ChainError
}

/**
 * Builds a Kernel account on the owner's own address through EIP-7702: the first user operation carries the
 * authorization that delegates the address to Kernel.
 *
 * **Details**
 *
 * With `sessions` (the default) the first user operation also installs Smart Sessions.
 *
 * **Gotchas**
 *
 * The owner must be a local key, which signs the authorization. Before the delegation is included, the account
 * cannot answer ERC-1271 checks.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export function fromEip7702(options: fromEip7702.Options): Promise<fromEip7702.ReturnType> {
  return run(internal.fromEip7702(options), options)
}

/**
 * Types of `KernelAccount.fromEip7702`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace fromEip7702 {
  /**
   * The client (with a chain), the owner's local key, and optionally the `version` and `sessions`.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends internal.FromEip7702Options, RunOptions {}
  /**
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ReturnType = KernelAccount
  /**
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = AccountError.AccountError | ChainError.ChainError
}
