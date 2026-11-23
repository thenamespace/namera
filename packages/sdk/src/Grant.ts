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
 * @stability experimental
 * @since 2.0.0
 */
import * as Predicate from "effect/Predicate"
import * as Result from "effect/Result"

import type * as AccountError from "./accounts/AccountError.ts"
import type * as SmartAccount from "./accounts/SmartAccount.ts"
import type * as ChainError from "./ChainError.ts"
import type * as GrantError from "./GrantError.ts"
import * as core from "./internal/core/grant/grant.ts"
import { describe as describeSession } from "./internal/core/session/describe.ts"
import * as internal from "./internal/grant/grant.ts"
import { parse as parseGrant } from "./internal/grant/parse.ts"
import { run, type RunOptions } from "./internal/promise.ts"
import type { ReadClient } from "./internal/viem/client.ts"
import type { BundlerClient, TransactionReceipt } from "./internal/viem/smartAccount.ts"
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
