/**
 * The Effect form of `SmartAccount`: build an account from an implementation, connect to an existing one, detect what
 * an address holds, and install Smart Sessions.
 *
 * @stability experimental
 * @since 2.0.0
 */
import type * as Effect from "effect/Effect"

import type * as AccountError from "../../accounts/AccountError.ts"
import * as detect_ from "../../accounts/internal/detect.ts"
import * as sessions from "../../accounts/internal/sessions.ts"
import * as internal from "../../accounts/internal/smartAccount.ts"
import type * as SmartAccount_ from "../../accounts/SmartAccount.ts"
import type * as ChainError from "../../ChainError.ts"
import type { Hex, ReadClient } from "../../internal/viem/client.ts"
import type { BundlerClient, TransactionReceipt } from "../../internal/viem/smartAccount.ts"

/**
 * A smart account Namera built: viem's `SmartAccount`, with its `namera` metadata.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type SmartAccount<Type extends SmartAccount_.Metadata["type"] = SmartAccount_.Metadata["type"]> =
  SmartAccount_.SmartAccount<Type>

/**
 * viem's smart account implementation: the options `SmartAccount.from` (and viem's `toSmartAccount`) take.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Implementation = SmartAccount_.Implementation

/**
 * Builds viem's smart account from an implementation, with the implementation's failures as Namera's errors.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const from: <const implementation extends Implementation>(
  implementation: implementation
) => Effect.Effect<
  SmartAccount_.from.ReturnType<implementation>,
  AccountError.AccountError | ChainError.ChainError
> = internal.from

/**
 * Connects to an existing account at an address, choosing Kernel, Nexus or Safe7579 from what `detect` finds.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const fromAddress: (
  options: Omit<SmartAccount_.fromAddress.Options, "signal">
) => Effect.Effect<SmartAccount, AccountError.AccountError | ChainError.ChainError> = detect_.fromAddress

/**
 * Reads which supported account an address holds, which version, and whether Smart Sessions is installed.
 *
 * @stability experimental
 * @category getters
 * @since 2.0.0
 */
export const detect = (
  client: ReadClient,
  options: { readonly address: Hex }
): Effect.Effect<SmartAccount_.detect.ReturnType, ChainError.ChainError> => detect_.detect(client, options.address)

/**
 * Returns the calls that install Smart Sessions on an account, to batch with other calls in one user operation.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const installSessionsCalls: (account: SmartAccount) => ReadonlyArray<SmartAccount_.Call> =
  sessions.installSessionsCalls

/**
 * Sends a user operation that installs Smart Sessions on the bundler client's account, and returns its hash.
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export const installSessions: (
  client: BundlerClient
) => Effect.Effect<Hex, AccountError.AccountError | ChainError.ChainError> = sessions.installSessions

/**
 * Installs Smart Sessions on the bundler client's account and waits for the user operation, returning its
 * transaction receipt.
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export const installSessionsSync: (
  client: BundlerClient
) => Effect.Effect<TransactionReceipt, AccountError.AccountError | ChainError.ChainError> = sessions.installSessionsSync

/**
 * Checks whether Smart Sessions is installed on the account at an address. An undeployed account has none.
 *
 * @stability experimental
 * @category getters
 * @since 2.0.0
 */
export const isSessionsInstalled = (
  client: ReadClient,
  options: { readonly address: Hex }
): Effect.Effect<boolean, ChainError.ChainError> => sessions.isSessionsInstalled(client, options.address)
