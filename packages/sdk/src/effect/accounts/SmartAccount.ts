/**
 * The Effect form of `SmartAccount`: build an account from an implementation, connect to an existing one, detect what
 * an address holds, install Smart Sessions, read and change its owners, and sign user operations on several chains
 * with one passkey prompt.
 *
 * @stability experimental
 * @since 2.0.0
 */
import type * as Effect from "effect/Effect"

import type * as AccountError from "../../accounts/AccountError.ts"
import * as detect_ from "../../accounts/internal/detect.ts"
import * as multichain from "../../accounts/internal/multichain.ts"
import * as owners from "../../accounts/internal/owners.ts"
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
 * Returns the calls that install Smart Sessions on an account, with SessionHook to run sessions' execution policies,
 * to batch with other calls in one user operation.
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
 * Checks whether Smart Sessions is installed on the account at an address, with SessionHook running for its
 * operations (bound to Smart Sessions on Kernel, the account's hook on Nexus and Safe7579). An undeployed account has
 * none.
 *
 * @stability experimental
 * @category getters
 * @since 2.0.0
 */
export const isSessionsInstalled = (
  client: ReadClient,
  options: { readonly address: Hex }
): Effect.Effect<boolean, ChainError.ChainError> => sessions.isSessionsInstalled(client, options.address)

/**
 * Signs user operations for accounts on several chains with one prompt per signing passkey, and returns each
 * operation's signature, in order.
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export const signUserOperations = (
  options: Omit<SmartAccount_.signUserOperations.Options, "signal">
): Effect.Effect<ReadonlyArray<Hex>, AccountError.AccountError> => multichain.signUserOperations(options.userOperations)

/**
 * Returns a stub signature of a multichain signature's shape, to prepare one of `count` user operations that
 * `signUserOperations` will sign together.
 *
 * @stability experimental
 * @category getters
 * @since 2.0.0
 */
export const getMultichainStubSignature = (
  account: SmartAccount,
  options: { readonly count: number }
): Effect.Effect<Hex, AccountError.AccountError> => multichain.stubSignature(account, options.count)

/**
 * Reads who controls the account at an address: each owner validator with its key owners or passkeys and its
 * threshold. An undeployed account has none on chain yet.
 *
 * @stability experimental
 * @category getters
 * @since 2.0.0
 */
export const getOwners = (
  client: ReadClient,
  options: { readonly address: Hex }
): Effect.Effect<ReadonlyArray<SmartAccount_.OwnerSet>, AccountError.AccountError | ChainError.ChainError> =>
  owners.getOwners(client, options.address)

/**
 * Returns the calls that adds a key or a passkey to the account's owner validator of that kind, to batch with other calls in one user operation.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const addOwnerCalls = (
  account: SmartAccount,
  options: { readonly owner: SmartAccount_.OwnerRef }
): Effect.Effect<ReadonlyArray<SmartAccount_.Call>, AccountError.AccountError | ChainError.ChainError> =>
  owners.addOwnerCalls(account, options.owner)

/**
 * Sends a user operation that adds a key or a passkey to the account's owner validator of that kind, from the bundler client's account, and returns its hash.
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export const addOwner = (
  client: BundlerClient,
  options: { readonly owner: SmartAccount_.OwnerRef }
): Effect.Effect<Hex, AccountError.AccountError | ChainError.ChainError> =>
  owners.send(client, (account) => owners.addOwnerCalls(account, options.owner))

/**
 * Sends a user operation that adds a key or a passkey to the account's owner validator of that kind, and waits for it, returning its transaction receipt.
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export const addOwnerSync = (
  client: BundlerClient,
  options: { readonly owner: SmartAccount_.OwnerRef }
): Effect.Effect<TransactionReceipt, AccountError.AccountError | ChainError.ChainError> =>
  owners.sendSync(client, (account) => owners.addOwnerCalls(account, options.owner))

/**
 * Returns the calls that removes a key or a passkey from the account, to batch with other calls in one user operation.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const removeOwnerCalls = (
  account: SmartAccount,
  options: { readonly owner: SmartAccount_.OwnerRef }
): Effect.Effect<ReadonlyArray<SmartAccount_.Call>, AccountError.AccountError | ChainError.ChainError> =>
  owners.removeOwnerCalls(account, options.owner)

/**
 * Sends a user operation that removes a key or a passkey from the account, from the bundler client's account, and returns its hash.
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export const removeOwner = (
  client: BundlerClient,
  options: { readonly owner: SmartAccount_.OwnerRef }
): Effect.Effect<Hex, AccountError.AccountError | ChainError.ChainError> =>
  owners.send(client, (account) => owners.removeOwnerCalls(account, options.owner))

/**
 * Sends a user operation that removes a key or a passkey from the account, and waits for it, returning its transaction receipt.
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export const removeOwnerSync = (
  client: BundlerClient,
  options: { readonly owner: SmartAccount_.OwnerRef }
): Effect.Effect<TransactionReceipt, AccountError.AccountError | ChainError.ChainError> =>
  owners.sendSync(client, (account) => owners.removeOwnerCalls(account, options.owner))

/**
 * Returns the calls that sets how many of the account's keys or passkeys must sign, to batch with other calls in one user operation.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const setThresholdCalls = (
  account: SmartAccount,
  options: { readonly threshold: number; readonly owners?: "key" | "passkey" | undefined }
): Effect.Effect<ReadonlyArray<SmartAccount_.Call>, AccountError.AccountError | ChainError.ChainError> =>
  owners.setThresholdCalls(account, options)

/**
 * Sends a user operation that sets how many of the account's keys or passkeys must sign, from the bundler client's account, and returns its hash.
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export const setThreshold = (
  client: BundlerClient,
  options: { readonly threshold: number; readonly owners?: "key" | "passkey" | undefined }
): Effect.Effect<Hex, AccountError.AccountError | ChainError.ChainError> =>
  owners.send(client, (account) => owners.setThresholdCalls(account, options))

/**
 * Sends a user operation that sets how many of the account's keys or passkeys must sign, and waits for it, returning its transaction receipt.
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export const setThresholdSync = (
  client: BundlerClient,
  options: { readonly threshold: number; readonly owners?: "key" | "passkey" | undefined }
): Effect.Effect<TransactionReceipt, AccountError.AccountError | ChainError.ChainError> =>
  owners.sendSync(client, (account) => owners.setThresholdCalls(account, options))

/**
 * Returns the calls that replaces an owner with another of the same kind, in one operation, to batch with other calls in one user operation.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const replaceOwnerCalls = (
  account: SmartAccount,
  options: { readonly owner: SmartAccount_.OwnerRef; readonly with: SmartAccount_.OwnerRef }
): Effect.Effect<ReadonlyArray<SmartAccount_.Call>, AccountError.AccountError | ChainError.ChainError> =>
  owners.replaceOwnerCalls(account, options)

/**
 * Sends a user operation that replaces an owner with another of the same kind, in one operation, from the bundler client's account, and returns its hash.
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export const replaceOwner = (
  client: BundlerClient,
  options: { readonly owner: SmartAccount_.OwnerRef; readonly with: SmartAccount_.OwnerRef }
): Effect.Effect<Hex, AccountError.AccountError | ChainError.ChainError> =>
  owners.send(client, (account) => owners.replaceOwnerCalls(account, options))

/**
 * Sends a user operation that replaces an owner with another of the same kind, in one operation, and waits for it, returning its transaction receipt.
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export const replaceOwnerSync = (
  client: BundlerClient,
  options: { readonly owner: SmartAccount_.OwnerRef; readonly with: SmartAccount_.OwnerRef }
): Effect.Effect<TransactionReceipt, AccountError.AccountError | ChainError.ChainError> =>
  owners.sendSync(client, (account) => owners.replaceOwnerCalls(account, options))

/**
 * Returns the calls that gives the account a second kind of owner: passkeys on an account owned by a key, or a key on one owned by passkeys, to batch with other calls in one user operation.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const addOwnerValidatorCalls = (
  account: SmartAccount,
  options: { readonly owner: Hex | SmartAccount_.Owner | SmartAccount_.Passkey | SmartAccount_.Passkeys }
): Effect.Effect<ReadonlyArray<SmartAccount_.Call>, AccountError.AccountError | ChainError.ChainError> =>
  owners.addOwnerValidatorCalls(account, options.owner)

/**
 * Sends a user operation that gives the account a second kind of owner: passkeys on an account owned by a key, or a key on one owned by passkeys, from the bundler client's account, and returns its hash.
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export const addOwnerValidator = (
  client: BundlerClient,
  options: { readonly owner: Hex | SmartAccount_.Owner | SmartAccount_.Passkey | SmartAccount_.Passkeys }
): Effect.Effect<Hex, AccountError.AccountError | ChainError.ChainError> =>
  owners.send(client, (account) => owners.addOwnerValidatorCalls(account, options.owner))

/**
 * Sends a user operation that gives the account a second kind of owner: passkeys on an account owned by a key, or a key on one owned by passkeys, and waits for it, returning its transaction receipt.
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export const addOwnerValidatorSync = (
  client: BundlerClient,
  options: { readonly owner: Hex | SmartAccount_.Owner | SmartAccount_.Passkey | SmartAccount_.Passkeys }
): Effect.Effect<TransactionReceipt, AccountError.AccountError | ChainError.ChainError> =>
  owners.sendSync(client, (account) => owners.addOwnerValidatorCalls(account, options.owner))
