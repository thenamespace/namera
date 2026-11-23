/**
 * The Effect form of `Grant`: grants, with failures in the error channel.
 *
 * @stability experimental
 * @since 2.0.0
 */
import * as Effect from "effect/Effect"

import type * as AccountError from "../accounts/AccountError.ts"
import type * as ChainError from "../ChainError.ts"
import * as Grant_ from "../Grant.ts"
import type * as GrantError from "../GrantError.ts"
import * as internal from "../internal/grant/grant.ts"
import { parse as parseGrant } from "../internal/grant/parse.ts"
import type { ReadClient } from "../internal/viem/client.ts"
import type { BundlerClient, TransactionReceipt } from "../internal/viem/smartAccount.ts"
import type * as SessionError from "../SessionError.ts"

/**
 * A grant, version 1.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Grant = Grant_.Grant

/**
 * One chain of a grant.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type GrantChain = Grant_.GrantChain

/**
 * A grant before the owner signs it.
 *
 * @stability experimental
 * @category models
 * @since 2.0.0
 */
export type Prepared = Grant_.Prepared

/**
 * Checks whether a value is a `Grant`.
 *
 * @stability experimental
 * @category guards
 * @since 2.0.0
 */
export const isGrant: (u: unknown) => u is Grant = Grant_.isGrant

/**
 * Creates a grant: validates the session, reads the enable nonces, and has the owner sign through the account.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const create: (
  options: Omit<Grant_.create.Options, "signal">
) => Effect.Effect<
  Grant,
  AccountError.AccountError | ChainError.ChainError | GrantError.GrantError | SessionError.SessionError
> = internal.create

/**
 * Prepares a grant for an external signer.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const prepare: (
  options: Omit<Grant_.create.Options, "signal">
) => Effect.Effect<Prepared, AccountError.AccountError | ChainError.ChainError | SessionError.SessionError> =
  internal.prepare

/**
 * Builds a grant from a prepared one and the owner's signatures.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const from = (options: Grant_.from.Options): Effect.Effect<Grant, GrantError.GrantError> =>
  Effect.fromResult(internal.from(options))

/**
 * Enables the session on chain now, from the owner's account.
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export const install: (
  client: BundlerClient,
  options: Omit<Grant_.install.Options, "signal">
) => Effect.Effect<`0x${string}`, AccountError.AccountError | ChainError.ChainError | SessionError.SessionError> =
  internal.install

/**
 * Enables the session on chain now and waits for it.
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export const installSync: (
  client: BundlerClient,
  options: Omit<Grant_.install.Options, "signal">
) => Effect.Effect<
  { readonly grant: Grant; readonly receipt: TransactionReceipt },
  AccountError.AccountError | ChainError.ChainError | SessionError.SessionError
> = internal.installSync

/**
 * Checks a grant's digests and the owner's signature on the client's chain.
 *
 * @stability experimental
 * @category utils
 * @since 2.0.0
 */
export const verify: (
  client: ReadClient,
  grant: Grant
) => Effect.Effect<void, ChainError.ChainError | GrantError.GrantError> = internal.verify

/**
 * Writes a grant as canonical JSON or as an `nmr1_` token.
 *
 * @stability experimental
 * @category conversions
 * @since 2.0.0
 */
export const serialize: (grant: Grant, options?: { readonly format?: "json" | "token" | undefined }) => string =
  Grant_.serialize

/**
 * Reads a grant from its JSON or token, failing with `GrantError`.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const parse = (input: unknown): Effect.Effect<Grant, GrantError.GrantError> =>
  Effect.fromResult(parseGrant(input))

/**
 * Describes a grant in plain language.
 *
 * @stability experimental
 * @category utils
 * @since 2.0.0
 */
export const describe: (grant: Grant, options?: Parameters<typeof Grant_.describe>[1]) => ReadonlyArray<string> =
  Grant_.describe
