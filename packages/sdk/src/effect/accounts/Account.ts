/**
 * The Effect form of `Account`: detect, connect to and install Smart Sessions on any supported account.
 *
 * @stability experimental
 * @since 2.0.0
 */
import type * as Effect from "effect/Effect"
import type { Chain, Client, Hex, TransactionReceipt, Transport } from "viem"
import type { SmartAccount } from "viem/account-abstraction"

import type * as Account_ from "../../accounts/Account.ts"
import type * as AccountError from "../../accounts/AccountError.ts"
import * as internal from "../../accounts/internal/account.ts"
import type * as ChainError from "../../ChainError.ts"

/**
 * A viem `SmartAccount` Namera built, with its `namera` metadata.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Account<Type extends Account_.Metadata["type"] = Account_.Metadata["type"]> = Account_.Account<Type>

/**
 * Reads which supported account an address holds, which version, and whether Smart Sessions is installed.
 *
 * @stability experimental
 * @category getters
 * @since 2.0.0
 */
export const detect = (
  client: Client<Transport, Chain | undefined>,
  options: { readonly address: Hex }
): Effect.Effect<Account_.detect.ReturnType, ChainError.ChainError> => internal.detect(client, options.address)

/**
 * Connects to an existing account, choosing Kernel, Nexus or Safe7579 from what `detect` finds.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const from: (
  options: Omit<Account_.from.Options, "signal">
) => Effect.Effect<Account, AccountError.AccountError | ChainError.ChainError> = internal.from

/**
 * Returns the calls that install Smart Sessions on an account, to batch with other calls in one user operation.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const installSessionsCalls: (account: Account) => ReadonlyArray<Account_.AccountCall> =
  internal.installSessionsCalls

/**
 * Sends a user operation that installs Smart Sessions on the bundler client's account, and returns its hash.
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export const installSessions: (
  client: Client<Transport, Chain | undefined, SmartAccount | undefined>
) => Effect.Effect<Hex, AccountError.AccountError | ChainError.ChainError> = internal.installSessions

/**
 * Installs Smart Sessions on the bundler client's account and waits for the user operation, returning its
 * transaction receipt.
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export const installSessionsSync: (
  client: Client<Transport, Chain | undefined, SmartAccount | undefined>
) => Effect.Effect<TransactionReceipt, AccountError.AccountError | ChainError.ChainError> = internal.installSessionsSync

/**
 * Checks whether Smart Sessions is installed on the account at an address. An undeployed account has none.
 *
 * @stability experimental
 * @category getters
 * @since 2.0.0
 */
export const isSessionsInstalled = (
  client: Client<Transport, Chain | undefined>,
  options: { readonly address: Hex }
): Effect.Effect<boolean, ChainError.ChainError> => internal.isSessionsInstalled(client, options.address)
