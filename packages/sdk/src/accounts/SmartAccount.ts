/**
 * Smart accounts as viem builds them: build one from an implementation, connect to an existing one, detect what an
 * address holds, install Smart Sessions, and sign user operations on several chains with one passkey prompt.
 *
 * **Details**
 *
 * Every account Namera returns is viem's `SmartAccount`, so viem's bundler client, paymasters and wagmi use it
 * unchanged. `SmartAccount.from` takes the same options as viem's `toSmartAccount`; `KernelAccount.from`,
 * `NexusAccount.from` and `Safe7579Account.from` are built on it and add a read-only `namera` field with the account's
 * type and version.
 *
 * **Gotchas**
 *
 * viem 3 has a `SmartAccount` module too (`viem/erc4337`), whose `SmartAccount.from` takes the same options. Import
 * only one of them per file, or rename one.
 *
 * @stability experimental
 * @since 2.0.0
 */
import type * as ChainError from "../ChainError.ts"
import type { Call as Call_ } from "../internal/core/account/erc7579.ts"
import { run, type RunOptions } from "../internal/promise.ts"
import type { AccountClient, Hex, Owner as Owner_, ReadClient } from "../internal/viem/client.ts"
import type { WebAuthnAccount } from "../internal/viem/signing.ts"
import type {
  BundlerClient,
  SmartAccount as ViemSmartAccount,
  SmartAccountImplementation,
  TransactionReceipt,
  UserOperationToSign
} from "../internal/viem/smartAccount.ts"
import type * as AccountError from "./AccountError.ts"
import * as detect_ from "./internal/detect.ts"
import * as multichain from "./internal/multichain.ts"
import type * as PasskeyOwners from "./internal/passkeys.ts"
import * as sessions from "./internal/sessions.ts"
import * as internal from "./internal/smartAccount.ts"

/**
 * What Namera records about an account it built, readable as `account.namera`.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Metadata<Type extends "kernel" | "nexus" | "safe7579" = "kernel" | "nexus" | "safe7579"> =
  internal.Metadata<Type>

/**
 * A smart account Namera built: viem's `SmartAccount`, with its `namera` metadata.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type SmartAccount<Type extends Metadata["type"] = Metadata["type"]> = internal.NameraSmartAccount<Type>

/**
 * viem's smart account implementation: the options `SmartAccount.from` (and viem's `toSmartAccount`) take.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Implementation = SmartAccountImplementation

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
 * A passkey owner: viem's WebAuthn account (`toWebAuthnAccount`), which signs with the device's authenticator.
 * Kernel, Nexus and Safe7579 accounts verify it through Namera's `WebAuthnValidator`.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Passkey = WebAuthnAccount

/**
 * Several passkey owners of one account and how many of them must sign each operation (`threshold`, 1 by default).
 * An account holds up to 16 passkeys.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Passkeys = Exclude<PasskeyOwners.Owner, WebAuthnAccount>

/**
 * A prepared user operation to sign, as viem's `prepareUserOperation` returns it.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type UserOperation = UserOperationToSign

/**
 * A call an account makes, as viem's bundler client takes them.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Call = Call_

/**
 * Builds viem's smart account from an implementation, with the implementation's failures as Namera's errors.
 *
 * **When to use**
 *
 * Use to build an account type Namera has no constructor for. For Kernel, Nexus and Safe7579 use their own `from`,
 * which compute the implementation.
 *
 * **Details**
 *
 * Takes the same options as viem's `toSmartAccount` and returns the same account. When viem calls the
 * implementation's methods, their failures come out as Namera's errors: a signing method's as `AccountError`
 * (`SigningFailed`), a viem or ox error from any other method as a `ChainError`, each with the original error as
 * `cause`.
 *
 * **Example** (Building an account from an implementation)
 *
 * ```ts
 * import { SmartAccount } from "@namera-ai/sdk"
 *
 * declare const implementation: SmartAccount.Implementation
 *
 * const account = await SmartAccount.from(implementation)
 * ```
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export function from<const implementation extends Implementation>(
  implementation: implementation,
  options?: RunOptions
): Promise<from.ReturnType<implementation>> {
  return run(internal.from(implementation), options)
}

/**
 * Types of `SmartAccount.from`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace from {
  /**
   * viem's smart account built from the implementation.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ReturnType<implementation extends Implementation = Implementation> = ViemSmartAccount<implementation>
  /**
   * The errors `SmartAccount.from` can fail with.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = AccountError.AccountError | ChainError.ChainError
}

/**
 * Connects to an existing account at an address, choosing Kernel, Nexus or Safe7579 from what `detect` finds.
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
 * **Example** (Connecting to an account another SDK created)
 *
 * ```ts
 * import { SmartAccount } from "@namera-ai/sdk"
 * import { createPublicClient, http } from "viem"
 * import { privateKeyToAccount } from "viem/accounts"
 * import { base } from "viem/chains"
 *
 * const client = createPublicClient({ chain: base, transport: http() })
 * const owner = privateKeyToAccount("0x0123456789012345678901234567890123456789012345678901234567890123")
 * const account = await SmartAccount.fromAddress({
 *   client,
 *   address: "0x0000000000000000000000000000000000000001",
 *   owner
 * })
 * ```
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export function fromAddress(options: fromAddress.Options): Promise<fromAddress.ReturnType> {
  return run(detect_.fromAddress(options), options)
}

/**
 * Types of `SmartAccount.fromAddress`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace fromAddress {
  /**
   * The client, the account's address, and its owner (or `owners`, for a Safe7579 with several keys). Passkey owners
   * work for Kernel, Nexus and Safe7579 accounts that are not EIP-7702: one passkey, or `{ passkeys, threshold }`
   * when more than one must sign.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends RunOptions {
    readonly client: AccountClient
    readonly address: Hex
    readonly owner?: Owner | Passkey | Passkeys | undefined
    readonly owners?: ReadonlyArray<Owner> | ReadonlyArray<Passkey> | undefined
  }
  /**
   * What `SmartAccount.fromAddress` resolves to.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ReturnType = SmartAccount
  /**
   * The errors `SmartAccount.fromAddress` can fail with.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = AccountError.AccountError | ChainError.ChainError
}

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
 * import { SmartAccount } from "@namera-ai/sdk"
 * import { createPublicClient, http } from "viem"
 * import { base } from "viem/chains"
 *
 * const client = createPublicClient({ chain: base, transport: http() })
 * const detected = await SmartAccount.detect(client, { address: "0x0000000000000000000000000000000000000001" })
 * if (detected.type === "kernel") console.log(detected.version, detected.sessionsInstalled)
 * ```
 *
 * @stability experimental
 * @category getters
 * @since 2.0.0
 */
export function detect(client: ReadClient, options: detect.Options): Promise<detect.ReturnType> {
  return run(detect_.detect(client, options.address), options)
}

/**
 * Types of `SmartAccount.detect`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace detect {
  /**
   * The options of `SmartAccount.detect`.
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
  export type ReturnType = detect_.Detected
  /**
   * The errors `SmartAccount.detect` can fail with.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = ChainError.ChainError
}

/**
 * Returns the calls that install Smart Sessions on an account, to batch with other calls in one user operation.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const installSessionsCalls: (account: SmartAccount) => ReadonlyArray<Call> = sessions.installSessionsCalls

/**
 * Sends a user operation that installs Smart Sessions on the bundler client's account, and returns its hash.
 *
 * **Example** (Installing Smart Sessions on an existing account)
 *
 * ```ts
 * import { KernelAccount, SmartAccount } from "@namera-ai/sdk"
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
 * const hash = await SmartAccount.installSessions(bundler)
 * ```
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export function installSessions(client: BundlerClient, options?: RunOptions): Promise<Hex> {
  return run(sessions.installSessions(client), options)
}

/**
 * Types of `SmartAccount.installSessions`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace installSessions {
  /**
   * The errors `SmartAccount.installSessions` can fail with.
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
export function installSessionsSync(client: BundlerClient, options?: RunOptions): Promise<TransactionReceipt> {
  return run(sessions.installSessionsSync(client), options)
}

/**
 * Types of `SmartAccount.installSessionsSync`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace installSessionsSync {
  /**
   * The errors `SmartAccount.installSessionsSync` can fail with.
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
export function isSessionsInstalled(client: ReadClient, options: isSessionsInstalled.Options): Promise<boolean> {
  return run(sessions.isSessionsInstalled(client, options.address), options)
}

/**
 * Types of `SmartAccount.isSessionsInstalled`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace isSessionsInstalled {
  /**
   * The options of `SmartAccount.isSessionsInstalled`.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends RunOptions {
    readonly address: Hex
  }
  /**
   * The errors `SmartAccount.isSessionsInstalled` can fail with.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = ChainError.ChainError
}

/**
 * Signs user operations for accounts on several chains with one prompt per signing passkey, and returns each
 * operation's signature, in order.
 *
 * **When to use**
 *
 * Use when one owner action spans chains, such as installing the same grant on Base and Arbitrum: the passkeys sign
 * once, instead of once per chain.
 *
 * **Details**
 *
 * The passkeys sign a Merkle root of the user operation hashes; each signature carries its operation's proof, and
 * `WebAuthnValidator` checks the operation is a leaf of the signed root. Every account must be one Namera built with
 * passkey owners, signed by the same passkeys.
 *
 * **Gotchas**
 *
 * A multichain signature is longer than a single-chain one. Prepare each operation with
 * `getMultichainStubSignature` as its `signature`, so the gas estimate covers the proof, then send it with the
 * returned signature.
 *
 * **Example** (Signing operations on two chains with one passkey prompt)
 *
 * ```ts
 * import { KernelAccount, SmartAccount } from "@namera-ai/sdk"
 * import { createPublicClient, http, zeroAddress } from "viem"
 * import { createBundlerClient, toWebAuthnAccount } from "viem/account-abstraction"
 * import { arbitrum, base } from "viem/chains"
 *
 * declare const credential: { id: string; publicKey: `0x${string}` }
 * const passkey = toWebAuthnAccount({ credential })
 * const calls = [{ to: zeroAddress, value: 0n }]
 *
 * const chains = await Promise.all([base, arbitrum].map(async (chain) => {
 *   const client = createPublicClient({ chain, transport: http() })
 *   const account = await KernelAccount.from({ client, owner: passkey })
 *   const bundler = createBundlerClient({ account, client, transport: http(`https://bundler.example/${chain.id}`) })
 *   const signature = await SmartAccount.getMultichainStubSignature(account, { count: 2 })
 *   const userOperation = await bundler.prepareUserOperation({ calls, signature })
 *   return { account, bundler, userOperation }
 * }))
 *
 * const signatures = await SmartAccount.signUserOperations({ userOperations: chains })
 * await Promise.all(chains.map(({ bundler, userOperation }, i) =>
 *   bundler.sendUserOperation({ ...userOperation, signature: signatures[i]! })
 * ))
 * ```
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export function signUserOperations(options: signUserOperations.Options): Promise<ReadonlyArray<Hex>> {
  return run(multichain.signUserOperations(options.userOperations), options)
}

/**
 * Types of `SmartAccount.signUserOperations`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace signUserOperations {
  /**
   * The user operations to sign, each with the account it is for.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends RunOptions {
    readonly userOperations: ReadonlyArray<{ readonly account: SmartAccount; readonly userOperation: UserOperation }>
  }
  /**
   * The errors `SmartAccount.signUserOperations` can fail with.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = AccountError.AccountError
}

/**
 * Returns a stub signature of a multichain signature's shape, to prepare one of `count` user operations that
 * `signUserOperations` will sign together.
 *
 * @stability experimental
 * @category getters
 * @since 2.0.0
 */
export function getMultichainStubSignature(
  account: SmartAccount,
  options: getMultichainStubSignature.Options
): Promise<Hex> {
  return run(multichain.stubSignature(account, options.count), options)
}

/**
 * Types of `SmartAccount.getMultichainStubSignature`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace getMultichainStubSignature {
  /**
   * How many user operations the multichain signature will cover.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends RunOptions {
    readonly count: number
  }
  /**
   * The errors `SmartAccount.getMultichainStubSignature` can fail with.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = AccountError.AccountError
}
