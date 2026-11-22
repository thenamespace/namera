/**
 * Safe 1.4.1 with Rhinestone's Safe7579 v2 adapter as a viem smart account: one or more owners on OwnableValidator,
 * with a signing threshold.
 *
 * @stability experimental
 * @since 2.0.0
 */
import type * as ChainError from "../ChainError.ts"
import { run, type RunOptions } from "../internal/promise.ts"
import type * as Account from "./Account.ts"
import type * as AccountError from "./AccountError.ts"
import * as internal from "./internal/safe7579.ts"

/**
 * A Safe7579 account built by Namera.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Safe7579Account = Account.Account<"safe7579">

/**
 * Builds a Safe7579 account for its owners, at its counterfactual address unless `address` is given.
 *
 * **Details**
 *
 * The Safe proxy factory deploys the account in the first user operation, adding the Safe7579 adapter through its
 * launchpad with no registry attesters. With `sessions` (the default) that deployment also installs Smart Sessions
 * as a validator. User operations and ERC-1271 signatures carry `threshold` owner signatures.
 *
 * **Gotchas**
 *
 * Fails with `AccountError` (`InvalidOptions`) when the owners repeat or `threshold` is not between 1 and the
 * number of owners. Safe7579 has no EIP-7702 path. Deployment costs about twice a Kernel's.
 *
 * **Example** (A two-of-two Safe7579 account)
 *
 * ```ts
 * import { Safe7579Account } from "@namera-ai/sdk"
 * import { createPublicClient, http } from "viem"
 * import { privateKeyToAccount } from "viem/accounts"
 * import { base } from "viem/chains"
 *
 * const client = createPublicClient({ chain: base, transport: http() })
 * const owners = [
 *   privateKeyToAccount("0x0123456789012345678901234567890123456789012345678901234567890123"),
 *   privateKeyToAccount("0x1123456789012345678901234567890123456789012345678901234567890123")
 * ]
 * const account = await Safe7579Account.from({ client, owners, threshold: 2 })
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
 * Types of `Safe7579Account.from`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace from {
  /**
   * The client (with a chain), the `owners` and optionally the `threshold` (all owners), `version` (`"2"`), `index`
   * (the salt nonce, `0n`), an existing `address`, and `sessions` (install Smart Sessions at deploy, `true`).
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
  export type ReturnType = Safe7579Account
  /**
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = AccountError.AccountError | ChainError.ChainError
}
