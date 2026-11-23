/**
 * Every supported smart account at once: detect which account an address holds, connect to it, and install Smart
 * Sessions on it.
 *
 * @stability experimental
 * @since 2.0.0
 */
import type { Chain, Client, Hex, TransactionReceipt, Transport } from "viem"
import type { SmartAccount } from "viem/account-abstraction"

import type * as ChainError from "../ChainError.ts"
import type { Call } from "../internal/core/account/erc7579.ts"
import { run, type RunOptions } from "../internal/promise.ts"
import type * as AccountError from "./AccountError.ts"
import * as internal from "./internal/account.ts"
import type {
  AccountClient,
  Metadata as Metadata_,
  NameraSmartAccount,
  Owner as Owner_
} from "./internal/smartAccount.ts"

/**
 * What Namera records about an account it built, readable as `account.namera`.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Metadata<Type extends "kernel" | "nexus" | "safe7579" = "kernel" | "nexus" | "safe7579"> = Metadata_<Type>

/**
 * A viem `SmartAccount` Namera built, with its `namera` metadata. It works with viem's bundler client unchanged.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Account<Type extends Metadata["type"] = Metadata["type"]> = NameraSmartAccount<Type>

/**
 * An owner of an account: a local key (`privateKeyToAccount`) or a JSON-RPC wallet account (EIP-1193), which signs
 * through the client.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Owner = Owner_

/**
 * A call an account makes, as viem's bundler client takes them.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type AccountCall = Call

/**
 * Reads which supported account an address holds, which version, and whether Smart Sessions is installed.
 *
 * **Details**
 *
 * Recognises Kernel and Nexus by their ERC-1967 implementation (or EIP-7702 delegation), and Safe7579 by its Safe
 * singleton and the adapter's `accountId`. Accounts other SDKs created are recognised when their implementation is
 * supported.
 *
 * **Example** (Detecting an account)
 *
 * ```ts
 * import { Account } from "@namera-ai/sdk"
 * import { createPublicClient, http } from "viem"
 * import { base } from "viem/chains"
 *
 * const client = createPublicClient({ chain: base, transport: http() })
 * const detected = await Account.detect(client, { address: "0x0000000000000000000000000000000000000001" })
 * if (detected.type === "kernel") console.log(detected.version, detected.sessionsInstalled)
 * ```
 *
 * @stability experimental
 * @category getters
 * @since 2.0.0
 */
export function detect(
  client: Client<Transport, Chain | undefined>,
  options: detect.Options
): Promise<detect.ReturnType> {
  return run(internal.detect(client, options.address), options)
}

/**
 * Types of `Account.detect`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace detect {
  /**
   * The options of `Account.detect`.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends RunOptions {
    readonly address: Hex
  }
  /**
   * A supported account with its version, an unsupported one with the implementation found, or no code at all.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ReturnType = internal.Detected
  /**
   * The errors `Account.detect` can fail with.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = ChainError.ChainError
}

/**
 * Connects to an existing account, choosing Kernel, Nexus or Safe7579 from what `detect` finds.
 *
 * **When to use**
 *
 * Use with accounts created elsewhere (ZeroDev, Biconomy or Safe tooling) when their implementation is supported.
 *
 * **Gotchas**
 *
 * Fails with `AccountError` (`NotSupported`) for an unsupported or undeployed account. An EIP-7702 account needs its
 * own local key as the owner.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export function from(options: from.Options): Promise<from.ReturnType> {
  return run(internal.from(options), options)
}

/**
 * Types of `Account.from`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace from {
  /**
   * The client, the account's address, and its owner (or `owners`, for a Safe7579 with several).
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends RunOptions {
    readonly client: AccountClient
    readonly address: Hex
    readonly owner?: Owner | undefined
    readonly owners?: ReadonlyArray<Owner> | undefined
  }
  /**
   * What `Account.from` resolves to.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ReturnType = Account
  /**
   * The errors `Account.from` can fail with.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = AccountError.AccountError | ChainError.ChainError
}

/**
 * Returns the calls that install Smart Sessions on an account, to batch with other calls in one user operation.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const installSessionsCalls: (account: Account) => ReadonlyArray<AccountCall> = internal.installSessionsCalls

/**
 * Sends a user operation that installs Smart Sessions on the bundler client's account, and returns its hash.
 *
 * **Example** (Installing Smart Sessions on an existing account)
 *
 * ```ts
 * import { Account, KernelAccount } from "@namera-ai/sdk"
 * import { createPublicClient, http } from "viem"
 * import { createBundlerClient } from "viem/account-abstraction"
 * import { privateKeyToAccount } from "viem/accounts"
 * import { base } from "viem/chains"
 *
 * const client = createPublicClient({ chain: base, transport: http() })
 * const owner = privateKeyToAccount("0x0123456789012345678901234567890123456789012345678901234567890123")
 * const account = await KernelAccount.from({ client, owner, sessions: false })
 * const bundler = createBundlerClient({ account, client, transport: http("https://bundler.example") })
 *
 * const hash = await Account.installSessions(bundler)
 * ```
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export function installSessions(
  client: Client<Transport, Chain | undefined, SmartAccount | undefined>,
  options?: RunOptions
): Promise<Hex> {
  return run(internal.installSessions(client), options)
}

/**
 * Types of `Account.installSessions`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace installSessions {
  /**
   * The errors `Account.installSessions` can fail with.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = AccountError.AccountError | ChainError.ChainError
}

/**
 * Installs Smart Sessions on the bundler client's account and waits for the user operation, returning its
 * transaction receipt.
 *
 * **Gotchas**
 *
 * Fails with `ChainError` (`Reverted`) when the operation is included but reverts.
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export function installSessionsSync(
  client: Client<Transport, Chain | undefined, SmartAccount | undefined>,
  options?: RunOptions
): Promise<TransactionReceipt> {
  return run(internal.installSessionsSync(client), options)
}

/**
 * Types of `Account.installSessionsSync`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace installSessionsSync {
  /**
   * The errors `Account.installSessionsSync` can fail with.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = AccountError.AccountError | ChainError.ChainError
}

/**
 * Checks whether Smart Sessions is installed on the account at an address. An undeployed account has none.
 *
 * @stability experimental
 * @category getters
 * @since 2.0.0
 */
export function isSessionsInstalled(
  client: Client<Transport, Chain | undefined>,
  options: isSessionsInstalled.Options
): Promise<boolean> {
  return run(internal.isSessionsInstalled(client, options.address), options)
}

/**
 * Types of `Account.isSessionsInstalled`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace isSessionsInstalled {
  /**
   * The options of `Account.isSessionsInstalled`.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends RunOptions {
    readonly address: Hex
  }
  /**
   * The errors `Account.isSessionsInstalled` can fail with.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = ChainError.ChainError
}
