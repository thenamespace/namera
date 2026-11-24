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
import { parse as parseGrant } from "./internal/grant/parse.ts"
import * as agent from "./internal/grant/toAccount.ts"
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
 * signs once when that signature verifies on every chain (Safe7579 with key owners), and once per chain otherwise
 * (Kernel and Nexus bind the chain in their ERC-1271 domain).
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
 * Each `lane` (Kernel 2^16, Nexus 2^24, Safe7579 2^32) is its own nonce sequence, so lanes send in parallel. Send the
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
