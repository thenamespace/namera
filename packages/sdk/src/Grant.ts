/**
 * Grants: the signed artifact that lets one agent use one session on one account, across one or more chains. The
 * owner signs once per grant (or once per chain where the account's ERC-1271 binds the chain); nothing is sent, and
 * the agent's first operation on each chain enables the session there.
 *
 * **Details**
 *
 * A grant is plain data, never holding a secret: the session (with the agent's public keys), the account's type and
 * deployment, and per chain the contracts, the enable nonce, the session digest and the owner's signature. It
 * serializes to JSON or to a compact `nmr1_` token, and `Grant.parse` reads both.
 *
 * The agent acts through `Grant.toAccount`: a viem smart account at the owner's address that sends and signs with
 * the session key, checking each operation against the session's policies first. `Grant.check` runs the same check
 * without a key.
 *
 * The owner revokes (`Grant.revoke`) and updates (`Grant.update`) a grant with owner operations; anyone reads its
 * status, limits and history without a key (`Grant.getStatus`, `Grant.getRemainingLimit`, `Grant.getUsage`,
 * `Grant.list`, `Grant.watchStatus`).
 *
 * @stability experimental
 * @since 2.0.0
 */
import * as Predicate from "effect/Predicate"
import * as Result from "effect/Result"

import type * as AccountError from "./accounts/AccountError.ts"
import type * as SmartAccount from "./accounts/SmartAccount.ts"
import type * as ChainError from "./ChainError.ts"
import type * as GrantError from "./GrantError.ts"
import type { Call } from "./internal/core/account/erc7579.ts"
import * as core from "./internal/core/grant/grant.ts"
import { describe as describeSession } from "./internal/core/session/describe.ts"
import * as checkInternal from "./internal/grant/check.ts"
import * as internal from "./internal/grant/grant.ts"
import * as history from "./internal/grant/history.ts"
import * as lifecycle from "./internal/grant/lifecycle.ts"
import { parse as parseGrant } from "./internal/grant/parse.ts"
import * as status from "./internal/grant/status.ts"
import * as agent from "./internal/grant/toAccount.ts"
import * as watch from "./internal/grant/watch.ts"
import { run, type RunOptions } from "./internal/promise.ts"
import type { ReadClient } from "./internal/viem/client.ts"
import type {
  BundlerClient,
  SmartAccount as ViemSmartAccount,
  TransactionReceipt
} from "./internal/viem/smartAccount.ts"
import type * as PolicyViolationError from "./PolicyViolationError.ts"
import type * as Session from "./Session.ts"
import type * as SessionError from "./SessionError.ts"

/**
 * A grant, version 1.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Grant = core.Grant

/**
 * One chain of a grant.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type GrantChain = core.GrantChain

/**
 * A grant before the owner signs it, with the typed data to sign.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Prepared = internal.Prepared

/**
 * Checks whether a value is a `Grant` (by shape; `Grant.parse` checks it fully).
 *
 * @stability experimental
 * @category guards
 * @since 2.0.0
 */
export const isGrant = (u: unknown): u is Grant =>
  Predicate.hasProperty(u, "version") && u.version === 1 && Predicate.hasProperty(u, "namespace")
  && u.namespace === "eip155" && Predicate.hasProperty(u, "session") && Predicate.hasProperty(u, "chains")
  && Array.isArray(u.chains)

/**
 * Creates a grant: validates the session (refusing it on problems), reads the enable nonce on each chain, and has the
 * owner sign through the account.
 *
 * **Details**
 *
 * Pass one account, or one per chain the grant should cover (the same account on each chain's client). The owner
 * signs once per chain: Kernel binds the chain in its ERC-1271 domain.
 *
 * **Gotchas**
 *
 * Rejects with `SessionError` (`InvalidSession`) for a session `Session.validate` refuses, `AccountError` for an
 * account Namera didn't build or an owner that didn't sign, and `ChainError` when a chain can't be read.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export function create(options: create.Options): Promise<Grant> {
  return run(internal.create(options), options)
}

/**
 * Types of `Grant.create`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace create {
  /**
   * The account (one per chain to cover) and the session.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends RunOptions {
    readonly account: SmartAccount.SmartAccount | ReadonlyArray<SmartAccount.SmartAccount>
    readonly session: Session.Session
  }
  /**
   * The errors `Grant.create` can reject with.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType =
    | AccountError.AccountError
    | ChainError.ChainError
    | GrantError.GrantError
    | SessionError.SessionError
}

/**
 * Prepares a grant for an external signer: everything but the signatures, and `typedData`, the EIP-712 data the
 * account signs (`account.signTypedData(prepared.typedData)`), the same for every chain.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export function prepare(options: create.Options): Promise<Prepared> {
  return run(internal.prepare(options), options)
}

/**
 * Types of `Grant.prepare`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace prepare {
  /**
   * The errors `Grant.prepare` can reject with.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = AccountError.AccountError | ChainError.ChainError | SessionError.SessionError
}

/**
 * Builds a grant from a prepared one and the owner's signature: `signature` for every chain, or `signatures` by
 * chain id where each chain needs its own.
 *
 * **Gotchas**
 *
 * Throws `GrantError` (`InvalidSignature`) for a chain without a signature. The signature itself is checked by
 * `Grant.verify` and on chain.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export function from(options: from.Options): Grant {
  return Result.getOrThrow(internal.from(options))
}

/**
 * Types of `Grant.from`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace from {
  /**
   * The prepared grant and the owner's signatures.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type Options = Prepared & {
    readonly signature?: `0x${string}` | undefined
    readonly signatures?: { readonly [chainId: number]: `0x${string}` } | undefined
  }
}

/**
 * Enables the session on chain now, from the owner's account (the bundler client's), returning the user operation's
 * hash.
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export function install(client: BundlerClient, options: install.Options): Promise<`0x${string}`> {
  return run(internal.install(client, options), options)
}

/**
 * Types of `Grant.install`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace install {
  /**
   * The session to enable.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends RunOptions {
    readonly session: Session.Session
  }
  /**
   * The errors `Grant.install` can reject with.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = AccountError.AccountError | ChainError.ChainError | SessionError.SessionError
}

/**
 * Enables the session on chain now and waits for it, returning the receipt and the grant of the installed session
 * (its chains carry no signature: the session is already enabled there).
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export function installSync(
  client: BundlerClient,
  options: install.Options
): Promise<{ readonly grant: Grant; readonly receipt: TransactionReceipt }> {
  return run(internal.installSync(client, options), options)
}

/**
 * Checks a grant on the client's chain: every chain's session digest against the grant's session, and the owner's
 * signature through the account (ERC-1271, or ERC-6492 while undeployed); for an installed grant, that the session
 * is enabled.
 *
 * **Gotchas**
 *
 * Rejects with `GrantError`: `ChainNotCovered`, `DigestMismatch` (the grant was altered) or `InvalidSignature`.
 *
 * @stability experimental
 * @category utils
 * @since 2.0.0
 */
export function verify(client: ReadClient, grant: Grant, options?: RunOptions): Promise<void> {
  return run(internal.verify(client, grant), options)
}

/**
 * Types of `Grant.verify`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace verify {
  /**
   * The errors `Grant.verify` can reject with.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = ChainError.ChainError | GrantError.GrantError
}

/**
 * The agent's account under a grant: a viem smart account at the owner's account address that sends user operations
 * and signs typed data with the session key, on the client's chain.
 *
 * **Details**
 *
 * Use it with viem's own tooling: `createBundlerClient({ account, client, transport })`, then `sendUserOperation`
 * and `waitForUserOperationReceipt`. The first operation on a chain enables the session (Smart Sessions' ENABLE
 * mode) and deploys the account if the grant carries its deployment and its factory is staked (Kernel); later ones
 * use the session. `signTypedData` gives an ERC-7739 session signature, where a `Policy.signTypedData` allows it, that
 * the account accepts once the session is enabled, when the typed data's verifying contract asks (viem's
 * `verifyTypedData` asks from its own validator contract, which no signing policy names).
 *
 * With `check` (the default), every operation and signature is checked against the session's policies first, with
 * the limits' usage read from the chain, and a violation rejects with `PolicyViolationError` before the session key
 * signs. The check is advisory: the contracts still decide.
 *
 * Each `lane` (0 to 2^16 - 1) is its own nonce sequence, so lanes send in parallel. Send the
 * first operation, which enables the session, on one lane before using others.
 *
 * **Gotchas**
 *
 * Rejects with `GrantError` (`SignerMismatch`) for a signer that isn't the session key, or fewer signers than its
 * threshold, and `ChainNotCovered` for a chain the grant doesn't cover; `AccountError` for a client without a chain or
 * a lane out of range. `signMessage` is not supported: Smart Sessions verifies typed data only.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export function toAccount(client: ReadClient, options: toAccount.Options): Promise<ViemSmartAccount> {
  return run(agent.toAccount(client, options), options)
}

/**
 * Types of `Grant.toAccount`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace toAccount {
  /**
   * A session key signer: a viem local account for an ECDSA session key, a viem WebAuthn account for a passkey.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type Signer = agent.Signer
  /**
   * The grant, the session key's signer (or its signers, as many as its threshold), the nonce lane (0 by default)
   * and whether to check policies before signing (`true` by default).
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends RunOptions {
    readonly grant: Grant
    readonly signer: Signer | ReadonlyArray<Signer>
    readonly lane?: number | undefined
    readonly check?: boolean | undefined
  }
  /**
   * The errors `Grant.toAccount` can reject with, and the account's `signUserOperation` and `signTypedData` with
   * `PolicyViolationError`.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType =
    | AccountError.AccountError
    | ChainError.ChainError
    | GrantError.GrantError
    | PolicyViolationError.PolicyViolationError
}

/**
 * Checks calls against a grant's session on the client's chain without a key: the policies the agent's account checks
 * before signing, with the limits' usage read from the chain, and a simulation of the calls from the EntryPoint when
 * the account is deployed.
 *
 * **Details**
 *
 * `ok` is true when no policy would refuse the calls and the simulation didn't revert. A gas budget isn't charged:
 * the operation's gas limits aren't known yet. Custom and execution policies are left to the chain.
 *
 * **Gotchas**
 *
 * Rejects with `GrantError` (`ChainNotCovered`) for a chain the grant doesn't cover, and `ChainError` when a chain
 * can't be read.
 *
 * @stability experimental
 * @category utils
 * @since 2.0.0
 */
export function check(client: ReadClient, options: check.Options): Promise<check.Result> {
  return run(checkInternal.check(client, options), options)
}

/**
 * Types of `Grant.check`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace check {
  /**
   * The grant and the calls to check.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends RunOptions {
    readonly grant: Grant
    readonly calls: ReadonlyArray<Call>
  }
  /**
   * Whether the calls would pass, every violation, and how the simulation went (`undefined` when not simulated).
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type Result = checkInternal.Checked
  /**
   * The errors `Grant.check` can reject with.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = ChainError.ChainError | GrantError.GrantError
}

const clientsOf = <Client>(input: Client | ReadonlyArray<Client>): ReadonlyArray<Client> =>
  Array.isArray(input) ? input : [input as Client]

/**
 * Revokes a grant with an owner operation through the owner's bundler client, or one per chain: an enabled session is
 * removed, an unused grant's enable signature is revoked (so a leaked grant can never be enabled), and nothing is sent
 * where the grant is already revoked. Returns the operation's hash, `undefined` when nothing was sent.
 *
 * **Gotchas**
 *
 * Rejects with `AccountError` when the bundler client's account isn't the grant's, and `GrantError`
 * (`ChainNotCovered`) for a chain the grant doesn't cover.
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export function revoke(client: BundlerClient, options: revoke.Options): Promise<`0x${string}` | undefined>
export function revoke(
  clients: ReadonlyArray<BundlerClient>,
  options: revoke.Options
): Promise<ReadonlyArray<`0x${string}` | undefined>>
export function revoke(
  client: BundlerClient | ReadonlyArray<BundlerClient>,
  options: revoke.Options
): Promise<`0x${string}` | undefined | ReadonlyArray<`0x${string}` | undefined>> {
  return run(lifecycle.revoke(clientsOf(client), options.grant), options).then((hashes) =>
    Array.isArray(client) ? hashes : hashes[0]
  )
}

/**
 * Types of `Grant.revoke`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace revoke {
  /**
   * The grant to revoke.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends RunOptions {
    readonly grant: Grant
  }
  /**
   * The errors `Grant.revoke` can reject with.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = AccountError.AccountError | ChainError.ChainError | GrantError.GrantError
}

/**
 * Revokes a grant and waits: the receipt of the operation, or of each chain's, `undefined` where nothing was sent.
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export function revokeSync(client: BundlerClient, options: revoke.Options): Promise<TransactionReceipt | undefined>
export function revokeSync(
  clients: ReadonlyArray<BundlerClient>,
  options: revoke.Options
): Promise<ReadonlyArray<TransactionReceipt | undefined>>
export function revokeSync(
  client: BundlerClient | ReadonlyArray<BundlerClient>,
  options: revoke.Options
): Promise<TransactionReceipt | undefined | ReadonlyArray<TransactionReceipt | undefined>> {
  return run(lifecycle.revokeSync(clientsOf(client), options.grant), options).then((receipts) =>
    Array.isArray(client) ? receipts : receipts[0]
  )
}

/**
 * The owner's call that revokes a grant, to batch with other calls yourself: Smart Sessions' `removeSession`, which
 * removes an enabled session and spends the enable nonce, so an unused grant can't enable it either.
 *
 * @stability experimental
 * @category utils
 * @since 2.0.0
 */
export const revokeCalls: (grant: Grant) => ReadonlyArray<Call> = lifecycle.revokeCalls

/**
 * Updates a grant's session in place with an owner operation through the owner's bundler client (or one per chain):
 * `remove` takes policies out (each must be one of the session's), `add` puts new ones in. The updated session is
 * validated before anything is sent, keeps the permission id, and keeps what its limits have used.
 *
 * **Details**
 *
 * The update disables what is removed, enables the updated session (adding what is new, reconfiguring what stays),
 * and revokes the old grant's enable signature, so it can't enable the old policies again. The updated grant is
 * installed on the chains updated: it carries no enable signature, and its agent uses the session as it is.
 *
 * **Gotchas**
 *
 * Rejects with `GrantError` (`PolicyNotFound`, `ChainNotCovered`), `SessionError` for an updated session
 * `Session.validate` refuses, and `AccountError` when the bundler client's account isn't the grant's.
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export function update(
  client: BundlerClient,
  options: update.Options
): Promise<{ readonly hash: `0x${string}`; readonly grant: Grant }>
export function update(
  clients: ReadonlyArray<BundlerClient>,
  options: update.Options
): Promise<{ readonly hashes: ReadonlyArray<`0x${string}`>; readonly grant: Grant }>
export function update(
  client: BundlerClient | ReadonlyArray<BundlerClient>,
  options: update.Options
): Promise<
  | { readonly hash: `0x${string}`; readonly grant: Grant }
  | { readonly hashes: ReadonlyArray<`0x${string}`>; readonly grant: Grant }
> {
  return run(lifecycle.update(clientsOf(client), options), options).then(({ grant, hashes }) =>
    Array.isArray(client) ? { hashes, grant } : { hash: hashes[0]!, grant }
  )
}

/**
 * Types of `Grant.update`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace update {
  /**
   * The grant, and the policies to add and to remove.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends RunOptions {
    readonly grant: Grant
    readonly add?: ReadonlyArray<Session.Session["policies"][number]> | undefined
    readonly remove?: ReadonlyArray<Session.Session["policies"][number]> | undefined
  }
  /**
   * The errors `Grant.update` can reject with.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType =
    | AccountError.AccountError
    | ChainError.ChainError
    | GrantError.GrantError
    | SessionError.SessionError
}

/**
 * Updates a grant and waits: the receipt (or each chain's) and the updated grant.
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export function updateSync(
  client: BundlerClient,
  options: update.Options
): Promise<{ readonly receipt: TransactionReceipt; readonly grant: Grant }>
export function updateSync(
  clients: ReadonlyArray<BundlerClient>,
  options: update.Options
): Promise<{ readonly receipts: ReadonlyArray<TransactionReceipt>; readonly grant: Grant }>
export function updateSync(
  client: BundlerClient | ReadonlyArray<BundlerClient>,
  options: update.Options
): Promise<
  | { readonly receipt: TransactionReceipt; readonly grant: Grant }
  | { readonly receipts: ReadonlyArray<TransactionReceipt>; readonly grant: Grant }
> {
  return run(lifecycle.updateSync(clientsOf(client), options), options).then(({ grant, receipts }) =>
    Array.isArray(client) ? { receipts, grant } : { receipt: receipts[0]!, grant }
  )
}

/**
 * The owner's calls that update an enabled grant's session, to batch with other calls yourself, and the updated
 * session. `Grant.update` also handles a session that isn't enabled yet and returns the updated grant.
 *
 * **Gotchas**
 *
 * Throws `GrantError` (`PolicyNotFound`) or `SessionError` for an updated session that can't be built.
 *
 * @stability experimental
 * @category utils
 * @since 2.0.0
 */
export function updateCalls(
  grant: Grant,
  options: Omit<update.Options, "grant" | "signal">
): { readonly calls: ReadonlyArray<Call>; readonly session: Session.Session } {
  return Result.getOrThrow(lifecycle.updateCalls(grant, options))
}

/**
 * A grant's state: overall, its window, on each chain (`pending-enable`, `active`, `expired`, `not-yet-valid` or
 * `revoked`), and what each budget has used and has left on the first chain. Pass one client, or one per chain.
 *
 * @stability experimental
 * @category utils
 * @since 2.0.0
 */
export function getStatus(
  client: ReadClient | ReadonlyArray<ReadClient>,
  options: getStatus.Options
): Promise<getStatus.Status> {
  return run(status.getStatus(clientsOf(client), options.grant), options)
}

/**
 * Types of `Grant.getStatus`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace getStatus {
  /**
   * The grant to read.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends RunOptions {
    readonly grant: Grant
  }
  /**
   * A grant's status.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type Status = status.Status
  /**
   * A grant's state on a chain.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type State = status.State
  /**
   * One budget's usage in the current period.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type LimitStatus = status.LimitStatus
  /**
   * The errors `Grant.getStatus` can reject with.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type ErrorType = ChainError.ChainError | GrantError.GrantError
}

/**
 * What is left of a grant's budget on the client's chain for a token, or for native value without one: the tightest
 * of its limits, with when it resets. `undefined` when nothing limits it.
 *
 * @stability experimental
 * @category utils
 * @since 2.0.0
 */
export function getRemainingLimit(
  client: ReadClient,
  options: getRemainingLimit.Options
): Promise<{ readonly remaining: bigint; readonly resetsAt?: number | undefined } | undefined> {
  return run(status.getRemainingLimit(client, options), options)
}

/**
 * Types of `Grant.getRemainingLimit`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace getRemainingLimit {
  /**
   * The grant, and the token (native value when absent).
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends RunOptions {
    readonly grant: Grant
    readonly token?: `0x${string}` | undefined
  }
}

/**
 * Whether a grant's session is enabled on the client's chain.
 *
 * @stability experimental
 * @category utils
 * @since 2.0.0
 */
export function isEnabled(client: ReadClient, options: getStatus.Options): Promise<boolean> {
  return run(status.isEnabled(client, options.grant), options)
}

/**
 * The operations sent under a grant on the client's chain, oldest first: from the EntryPoint's logs for the account,
 * kept when the operation's signature names the grant's session. Logs are read `pageSize` blocks at a time.
 *
 * **Gotchas**
 *
 * Reading from block 0 over a long chain takes many requests: pass `fromBlock` (the block the grant was created in).
 * An operation bundled through a contract other than the EntryPoint can't be read and is left out.
 *
 * @stability experimental
 * @category utils
 * @since 2.0.0
 */
export function getUsage(
  client: ReadClient,
  options: getUsage.Options
): Promise<ReadonlyArray<getUsage.Operation>> {
  return run(history.getUsage(client, options), options)
}

/**
 * Types of `Grant.getUsage`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace getUsage {
  /**
   * The grant, the blocks to read (from 0 to the latest by default) and how many blocks a log request covers
   * (10,000 by default).
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends RunOptions {
    readonly grant: Grant
    readonly fromBlock?: bigint | undefined
    readonly toBlock?: bigint | undefined
    readonly pageSize?: bigint | undefined
  }
  /**
   * One operation sent under the grant.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type Operation = history.Operation
}

/**
 * The sessions enabled on an account on the client's chain, with their windows, matched to `grants` by permission id.
 * Smart Sessions stores ids, not sessions, so a session without a grant among those given is `foreign`.
 *
 * @stability experimental
 * @category utils
 * @since 2.0.0
 */
export function list(client: ReadClient, options: list.Options): Promise<ReadonlyArray<list.Listed>> {
  return run(status.list(client, options), options)
}

/**
 * Types of `Grant.list`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace list {
  /**
   * The account, and the grants to match.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options extends RunOptions {
    readonly account: `0x${string}`
    readonly grants?: ReadonlyArray<Grant> | undefined
  }
  /**
   * A session enabled on the account.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type Listed = status.Listed
}

/**
 * Watches a grant: calls `onChange` with its status now and whenever it changes, read on each new block of the
 * (first) client's chain, and `onError` when a read fails (the watch goes on). `off()` stops it.
 *
 * @stability experimental
 * @category utils
 * @since 2.0.0
 */
export const watchStatus = (
  client: ReadClient | ReadonlyArray<ReadClient>,
  options: watchStatus.Options
): watchStatus.Watcher => watch.watchStatus(clientsOf(client), options)

/**
 * Types of `Grant.watchStatus`.
 *
 * @stability experimental
 * @since 2.0.0
 */
export declare namespace watchStatus {
  /**
   * The grant, the callbacks, and how often to poll for blocks (the client's interval by default).
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export interface Options {
    readonly grant: Grant
    readonly onChange: (status: getStatus.Status) => void
    readonly onError?: ((error: getStatus.ErrorType) => void) | undefined
    readonly pollingInterval?: number | undefined
  }
  /**
   * A running watch.
   *
   * @stability experimental
   * @category utility types
   * @since 2.0.0
   */
  export type Watcher = watch.Watcher
}

/**
 * Writes a grant as canonical JSON (bigints as `{ "$n": "…" }`), or as a compact `nmr1_` token for links and QR
 * codes.
 *
 * @stability experimental
 * @category conversions
 * @since 2.0.0
 */
export const serialize = (grant: Grant, options?: { readonly format?: "json" | "token" | undefined }): string =>
  options?.format === "token" ? core.toToken(grant) : core.toJson(grant)

/**
 * Reads a grant from its JSON or token (or the value), checking its shape, version and session.
 *
 * **Gotchas**
 *
 * Throws `GrantError`: `VersionUnsupported` for another version, `Malformed` for anything else wrong, including
 * unknown fields and a session that doesn't match the grant's id.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export function parse(input: unknown): Grant {
  return Result.getOrThrow(parseGrant(input))
}

/**
 * Describes a grant in plain language: the account, the chains, and the session's lines, recomputed from its
 * policies (the stored `summary` is never trusted).
 *
 * @stability experimental
 * @category utils
 * @since 2.0.0
 */
export const describe = (grant: Grant, options?: Session.describe.Options): ReadonlyArray<string> => [
  `For the ${grant.accountType.type} account ${core.accountAddress(grant)} on ${
    grant.chains.map((chain) => chain.chain).join(", ")
  }.`,
  ...describeSession(grant.session, options)
]
