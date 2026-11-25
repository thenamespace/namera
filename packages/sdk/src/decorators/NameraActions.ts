/**
 * The optional viem decorator: Namera's network functions under `client.namera`, bound to the client.
 *
 * **Details**
 *
 * `client.extend(nameraActions())` adds one namespace, `namera`, with a `grant` and an `account` bag. Each method
 * calls the standalone function of the same name with the client as its first argument and holds no state, so the
 * decorator and the standalone functions are interchangeable. viem's own actions are untouched.
 *
 * @stability experimental
 * @since 2.0.0
 */
import * as SmartAccount from "../accounts/SmartAccount.ts"
import * as Grant from "../Grant.ts"
import type { RunOptions } from "../internal/promise.ts"
import type { Hex, ReadClient } from "../internal/viem/client.ts"
import type {
  BundlerClient,
  SmartAccount as ViemSmartAccount,
  TransactionReceipt
} from "../internal/viem/smartAccount.ts"

/**
 * Adds Namera's network functions to a viem client, under `client.namera`.
 *
 * **When to use**
 *
 * Use when an app passes one viem client around and prefers `client.namera.grant.getStatus({ grant })` to
 * `Grant.getStatus(client, { grant })`.
 *
 * **Details**
 *
 * On a public client, `namera` carries the reads (`grant.getStatus`, `account.detect`, …). On a bundler client (one
 * with viem's bundler actions, as `createBundlerClient` returns), it also carries the owner operations
 * (`grant.revoke`, `account.installSessions`, …); the type of a public client has no writes, so calling one is a type
 * error. `grant.create` and `grant.prepare` forward their options as they are: the account carries its own client.
 *
 * **Example** (Decorating a public client)
 *
 * ```ts import.meta.vitest
 * import { nameraActions } from "@namera-ai/sdk/decorators"
 * import { createPublicClient, http } from "viem"
 * import { base } from "viem/chains"
 *
 * const client = createPublicClient({ chain: base, transport: http() }).extend(nameraActions())
 *
 * typeof client.namera.grant.getStatus // => "function"
 * typeof client.namera.account.detect // => "function"
 * "revoke" in client.namera.grant // => true
 * ```
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export function nameraActions(): <sendUserOperation = undefined>(
  client: nameraActions.Extendable<sendUserOperation>
) => nameraActions.Decorator<sendUserOperation> {
  return <sendUserOperation = undefined>(
    extended: nameraActions.Extendable<sendUserOperation>
  ): nameraActions.Decorator<sendUserOperation> => {
    // viem's `extend` passes the client itself. The writes are typed only on bundler clients; the standalone functions
    // check the account at run time.
    const client = extended as unknown as ReadClient
    const bundler = extended as unknown as BundlerClient
    const grant: nameraActions.GrantWriteActions = {
      create: (options) => Grant.create(options),
      prepare: (options) => Grant.prepare(options),
      verify: (grant, options) => Grant.verify(client, grant, options),
      toAccount: (options) => Grant.toAccount(client, options),
      check: (options) => Grant.check(client, options),
      getStatus: (options) => Grant.getStatus(client, options),
      getRemainingLimit: (options) => Grant.getRemainingLimit(client, options),
      isEnabled: (options) => Grant.isEnabled(client, options),
      getUsage: (options) => Grant.getUsage(client, options),
      list: (options) => Grant.list(client, options),
      watchStatus: (options) => Grant.watchStatus(client, options),
      install: (options) => Grant.install(bundler, options),
      installSync: (options) => Grant.installSync(bundler, options),
      revoke: (options) => Grant.revoke(bundler, options),
      revokeSync: (options) => Grant.revokeSync(bundler, options),
      update: (options) => Grant.update(bundler, options),
      updateSync: (options) => Grant.updateSync(bundler, options)
    }
    const account: nameraActions.AccountWriteActions = {
      detect: (options) => SmartAccount.detect(client, options),
      isSessionsInstalled: (options) => SmartAccount.isSessionsInstalled(client, options),
      getOwners: (options) => SmartAccount.getOwners(client, options),
      installSessions: (options) => SmartAccount.installSessions(bundler, options),
      installSessionsSync: (options) => SmartAccount.installSessionsSync(bundler, options),
      addOwner: (options) => SmartAccount.addOwner(bundler, options),
      addOwnerSync: (options) => SmartAccount.addOwnerSync(bundler, options),
      removeOwner: (options) => SmartAccount.removeOwner(bundler, options),
      removeOwnerSync: (options) => SmartAccount.removeOwnerSync(bundler, options),
      setThreshold: (options) => SmartAccount.setThreshold(bundler, options),
      setThresholdSync: (options) => SmartAccount.setThresholdSync(bundler, options),
      replaceOwner: (options) => SmartAccount.replaceOwner(bundler, options),
      replaceOwnerSync: (options) => SmartAccount.replaceOwnerSync(bundler, options),
      addOwnerValidator: (options) => SmartAccount.addOwnerValidator(bundler, options),
      addOwnerValidatorSync: (options) => SmartAccount.addOwnerValidatorSync(bundler, options)
    }
    return { namera: { grant, account } } as nameraActions.Decorator<sendUserOperation>
  }
}

/**
 * Types of `nameraActions`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace nameraActions {
  /**
   * The client `extend` passes, as far as the decorator's types read it: whether it has viem's bundler actions
   * (`sendUserOperation`, as `createBundlerClient` adds them).
   *
   * **Details**
   *
   * Inferring only that one member, rather than the whole client, keeps the decorator cheap to type-check.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Extendable<sendUserOperation = undefined> {
    readonly request: unknown
    readonly sendUserOperation?: sendUserOperation
  }

  /**
   * What `nameraActions()` adds to a client: the `namera` namespace, with the owner operations when
   * `sendUserOperation` (the client's bundler action) is present.
   *
   * **Details**
   *
   * A type alias rather than an interface because viem's `extend` accepts only types with an implicit index signature;
   * the namespace itself is the named `Namera` interface.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type Decorator<sendUserOperation = undefined> = { readonly namera: Namera<sendUserOperation> }

  /**
   * The `namera` namespace: grant and account functions, with the owner operations only on bundler clients.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Namera<sendUserOperation = undefined> {
    readonly grant: [sendUserOperation] extends [undefined] ? GrantActions : GrantWriteActions
    readonly account: [sendUserOperation] extends [undefined] ? AccountActions : AccountWriteActions
  }

  /**
   * The grant functions every client gets: `Grant.<name>` with the client bound.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface GrantActions {
    readonly create: (options: Grant.create.Options) => Promise<Grant.Grant>
    readonly prepare: (options: Grant.create.Options) => Promise<Grant.Prepared>
    readonly verify: (grant: Grant.Grant, options?: RunOptions) => Promise<void>
    readonly toAccount: (options: Grant.toAccount.Options) => Promise<ViemSmartAccount>
    readonly check: (options: Grant.check.Options) => Promise<Grant.check.Result>
    readonly getStatus: (options: Grant.getStatus.Options) => Promise<Grant.getStatus.Status>
    readonly getRemainingLimit: (
      options: Grant.getRemainingLimit.Options
    ) => Promise<{ readonly remaining: bigint; readonly resetsAt?: number | undefined } | undefined>
    readonly isEnabled: (options: Grant.getStatus.Options) => Promise<boolean>
    readonly getUsage: (options: Grant.getUsage.Options) => Promise<ReadonlyArray<Grant.getUsage.Operation>>
    readonly list: (options: Grant.list.Options) => Promise<ReadonlyArray<Grant.list.Listed>>
    readonly watchStatus: (options: Grant.watchStatus.Options) => Grant.watchStatus.Watcher
  }

  /**
   * The grant functions a bundler client gets besides the reads: the owner operations.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface GrantWriteActions extends GrantActions {
    readonly install: (options: Grant.install.Options) => Promise<Hex>
    readonly installSync: (
      options: Grant.install.Options
    ) => Promise<{ readonly grant: Grant.Grant; readonly receipt: TransactionReceipt }>
    readonly revoke: (options: Grant.revoke.Options) => Promise<Hex | undefined>
    readonly revokeSync: (options: Grant.revoke.Options) => Promise<TransactionReceipt | undefined>
    readonly update: (
      options: Grant.update.Options
    ) => Promise<{ readonly hash: Hex; readonly grant: Grant.Grant }>
    readonly updateSync: (
      options: Grant.update.Options
    ) => Promise<{ readonly receipt: TransactionReceipt; readonly grant: Grant.Grant }>
  }

  /**
   * The account functions every client gets: `SmartAccount.<name>` with the client bound.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface AccountActions {
    readonly detect: (options: SmartAccount.detect.Options) => Promise<SmartAccount.detect.ReturnType>
    readonly isSessionsInstalled: (options: SmartAccount.isSessionsInstalled.Options) => Promise<boolean>
    readonly getOwners: (options: SmartAccount.getOwners.Options) => Promise<ReadonlyArray<SmartAccount.OwnerSet>>
  }

  /**
   * The account functions a bundler client gets besides the reads: the owner operations on its account.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface AccountWriteActions extends AccountActions {
    readonly installSessions: (options?: RunOptions) => Promise<Hex>
    readonly installSessionsSync: (options?: RunOptions) => Promise<TransactionReceipt>
    readonly addOwner: (options: SmartAccount.addOwnerCalls.Options) => Promise<Hex>
    readonly addOwnerSync: (options: SmartAccount.addOwnerCalls.Options) => Promise<TransactionReceipt>
    readonly removeOwner: (options: SmartAccount.removeOwnerCalls.Options) => Promise<Hex>
    readonly removeOwnerSync: (options: SmartAccount.removeOwnerCalls.Options) => Promise<TransactionReceipt>
    readonly setThreshold: (options: SmartAccount.setThresholdCalls.Options) => Promise<Hex>
    readonly setThresholdSync: (options: SmartAccount.setThresholdCalls.Options) => Promise<TransactionReceipt>
    readonly replaceOwner: (options: SmartAccount.replaceOwnerCalls.Options) => Promise<Hex>
    readonly replaceOwnerSync: (options: SmartAccount.replaceOwnerCalls.Options) => Promise<TransactionReceipt>
    readonly addOwnerValidator: (options: SmartAccount.addOwnerValidatorCalls.Options) => Promise<Hex>
    readonly addOwnerValidatorSync: (
      options: SmartAccount.addOwnerValidatorCalls.Options
    ) => Promise<TransactionReceipt>
  }
}
