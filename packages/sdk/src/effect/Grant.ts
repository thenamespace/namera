/**
 * The Effect form of `Grant`: grants, with failures in the error channel.
 *
 * **Example** (Creating a grant and reading its status)
 *
 * ```ts
 * import { Grant, KernelAccount, Policy, Session, SessionKey } from "@namera-ai/sdk/effect"
 * import { Effect } from "effect"
 * import { createPublicClient, http } from "viem"
 * import { privateKeyToAccount } from "viem/accounts"
 * import { base } from "viem/chains"
 *
 * const client = createPublicClient({ chain: base, transport: http() })
 * const owner = privateKeyToAccount("0x…")
 *
 * const program = Effect.gen(function*() {
 *   const account = yield* KernelAccount.from({ client, owner })
 *   const session = yield* Session.from({
 *     signer: yield* SessionKey.ecdsa("0x…"),
 *     validUntil: (yield* Session.now()) + 86400,
 *     policies: [Policy.nativeTransfer({ to: "0x…", value: { lte: 10n ** 16n } })]
 *   })
 *   const grant = yield* Grant.create({ account, session })
 *   return yield* Grant.getStatus(client, { grant })
 * }).pipe(Effect.catchTag("SessionError", (error) => Effect.die(error.reason.problems)))
 * ```
 *
 * @stability experimental
 * @since 2.0.0
 */
import * as Effect from "effect/Effect"

import type * as AccountError from "../accounts/AccountError.ts"
import type * as ChainError from "../ChainError.ts"
import * as Grant_ from "../Grant.ts"
import type * as GrantError from "../GrantError.ts"
import type { Call } from "../internal/core/account/erc7579.ts"
import * as checkInternal from "../internal/grant/check.ts"
import * as internal from "../internal/grant/grant.ts"
import * as history from "../internal/grant/history.ts"
import * as lifecycle from "../internal/grant/lifecycle.ts"
import { parse as parseGrant } from "../internal/grant/parse.ts"
import * as status from "../internal/grant/status.ts"
import * as agent from "../internal/grant/toAccount.ts"
import type { ReadClient } from "../internal/viem/client.ts"
import type { BundlerClient, SmartAccount, TransactionReceipt } from "../internal/viem/smartAccount.ts"
import type * as Session from "../Session.ts"
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
 * The agent's account under a grant, on the client's chain. Its viem hooks reject (as Promises, for viem) with
 * `PolicyViolationError` when a policy would refuse.
 *
 * @stability experimental
 * @category constructors
 * @since 2.0.0
 */
export const toAccount: (
  client: ReadClient,
  options: Omit<Grant_.toAccount.Options, "signal">
) => Effect.Effect<SmartAccount, AccountError.AccountError | ChainError.ChainError | GrantError.GrantError> =
  agent.toAccount

/**
 * Checks calls against a grant's session without a key.
 *
 * @stability experimental
 * @category utils
 * @since 2.0.0
 */
export const check: (
  client: ReadClient,
  options: Omit<Grant_.check.Options, "signal">
) => Effect.Effect<Grant_.check.Result, ChainError.ChainError | GrantError.GrantError> = checkInternal.check

const clientsOf = <Client>(input: Client | ReadonlyArray<Client>): ReadonlyArray<Client> =>
  Array.isArray(input) ? input : [input as Client]

/**
 * Revokes a grant with an owner operation (one per chain for several clients); `undefined` where nothing was sent.
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export const revoke: {
  (
    client: BundlerClient,
    options: Omit<Grant_.revoke.Options, "signal">
  ): Effect.Effect<`0x${string}` | undefined, Grant_.revoke.ErrorType>
  (
    clients: ReadonlyArray<BundlerClient>,
    options: Omit<Grant_.revoke.Options, "signal">
  ): Effect.Effect<ReadonlyArray<`0x${string}` | undefined>, Grant_.revoke.ErrorType>
} =
  ((client: BundlerClient | ReadonlyArray<BundlerClient>, options: Omit<Grant_.revoke.Options, "signal">) =>
    lifecycle.revoke(clientsOf(client), options.grant).pipe(
      Effect.map((hashes) => (Array.isArray(client) ? hashes : hashes[0]))
    )) as never

/**
 * Revokes a grant and waits for the receipts.
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export const revokeSync: {
  (
    client: BundlerClient,
    options: Omit<Grant_.revoke.Options, "signal">
  ): Effect.Effect<TransactionReceipt | undefined, Grant_.revoke.ErrorType>
  (
    clients: ReadonlyArray<BundlerClient>,
    options: Omit<Grant_.revoke.Options, "signal">
  ): Effect.Effect<ReadonlyArray<TransactionReceipt | undefined>, Grant_.revoke.ErrorType>
} =
  ((client: BundlerClient | ReadonlyArray<BundlerClient>, options: Omit<Grant_.revoke.Options, "signal">) =>
    lifecycle.revokeSync(clientsOf(client), options.grant).pipe(
      Effect.map((receipts) => (Array.isArray(client) ? receipts : receipts[0]))
    )) as never

/**
 * The owner's call that revokes a grant, to batch yourself.
 *
 * @stability experimental
 * @category utils
 * @since 2.0.0
 */
export const revokeCalls: (grant: Grant) => ReadonlyArray<Call> = Grant_.revokeCalls

/**
 * Updates a grant's session in place with an owner operation (one per chain for several clients).
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export const update: {
  (
    client: BundlerClient,
    options: Omit<Grant_.update.Options, "signal">
  ): Effect.Effect<{ readonly hash: `0x${string}`; readonly grant: Grant }, Grant_.update.ErrorType>
  (
    clients: ReadonlyArray<BundlerClient>,
    options: Omit<Grant_.update.Options, "signal">
  ): Effect.Effect<{ readonly hashes: ReadonlyArray<`0x${string}`>; readonly grant: Grant }, Grant_.update.ErrorType>
} =
  ((client: BundlerClient | ReadonlyArray<BundlerClient>, options: Omit<Grant_.update.Options, "signal">) =>
    lifecycle.update(clientsOf(client), options).pipe(
      Effect.map(({ grant, hashes }) => (Array.isArray(client) ? { hashes, grant } : { hash: hashes[0]!, grant }))
    )) as never

/**
 * Updates a grant and waits for the receipts.
 *
 * @stability experimental
 * @category mutations
 * @since 2.0.0
 */
export const updateSync: {
  (
    client: BundlerClient,
    options: Omit<Grant_.update.Options, "signal">
  ): Effect.Effect<{ readonly receipt: TransactionReceipt; readonly grant: Grant }, Grant_.update.ErrorType>
  (
    clients: ReadonlyArray<BundlerClient>,
    options: Omit<Grant_.update.Options, "signal">
  ): Effect.Effect<
    { readonly receipts: ReadonlyArray<TransactionReceipt>; readonly grant: Grant },
    Grant_.update.ErrorType
  >
} =
  ((client: BundlerClient | ReadonlyArray<BundlerClient>, options: Omit<Grant_.update.Options, "signal">) =>
    lifecycle.updateSync(clientsOf(client), options).pipe(
      Effect.map(({ grant, receipts }) =>
        Array.isArray(client) ? { receipts, grant } : { receipt: receipts[0]!, grant }
      )
    )) as never

/**
 * The owner's calls that update an enabled grant's session, and the updated session.
 *
 * @stability experimental
 * @category utils
 * @since 2.0.0
 */
export const updateCalls = (
  grant: Grant,
  options: Omit<Grant_.update.Options, "grant" | "signal">
): Effect.Effect<
  { readonly calls: ReadonlyArray<Call>; readonly session: Session.Session },
  GrantError.GrantError | SessionError.SessionError
> => Effect.fromResult(lifecycle.updateCalls(grant, options))

/**
 * A grant's state overall, on each chain, and its first chain's limits.
 *
 * @stability experimental
 * @category utils
 * @since 2.0.0
 */
export const getStatus = (
  client: ReadClient | ReadonlyArray<ReadClient>,
  options: Omit<Grant_.getStatus.Options, "signal">
): Effect.Effect<Grant_.getStatus.Status, Grant_.getStatus.ErrorType> =>
  status.getStatus(clientsOf(client), options.grant)

/**
 * What is left of a grant's budget for a token, or native value without one.
 *
 * @stability experimental
 * @category utils
 * @since 2.0.0
 */
export const getRemainingLimit: (
  client: ReadClient,
  options: Omit<Grant_.getRemainingLimit.Options, "signal">
) => Effect.Effect<
  { readonly remaining: bigint; readonly resetsAt?: number | undefined } | undefined,
  Grant_.getStatus.ErrorType
> = status.getRemainingLimit

/**
 * Whether a grant's session is enabled on the client's chain.
 *
 * @stability experimental
 * @category utils
 * @since 2.0.0
 */
export const isEnabled = (
  client: ReadClient,
  options: Omit<Grant_.getStatus.Options, "signal">
): Effect.Effect<boolean, Grant_.getStatus.ErrorType> => status.isEnabled(client, options.grant)

/**
 * The operations sent under a grant on the client's chain.
 *
 * @stability experimental
 * @category utils
 * @since 2.0.0
 */
export const getUsage: (
  client: ReadClient,
  options: Omit<Grant_.getUsage.Options, "signal">
) => Effect.Effect<ReadonlyArray<Grant_.getUsage.Operation>, Grant_.getStatus.ErrorType> = history.getUsage

/**
 * The sessions enabled on an account, matched to the grants given.
 *
 * @stability experimental
 * @category utils
 * @since 2.0.0
 */
export const list: (
  client: ReadClient,
  options: Omit<Grant_.list.Options, "signal">
) => Effect.Effect<ReadonlyArray<Grant_.list.Listed>, ChainError.ChainError> = status.list

/**
 * Watches a grant's status, block by block; `off()` stops it.
 *
 * @stability experimental
 * @category utils
 * @since 2.0.0
 */
export const watchStatus: typeof Grant_.watchStatus = Grant_.watchStatus

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
 * **Example** (Recovering from input that isn't a grant)
 *
 * ```ts import.meta.vitest
 * import { Grant } from "@namera-ai/sdk/effect"
 * import { Effect } from "effect"
 *
 * const program = Grant.parse("not a grant").pipe(
 *   Effect.map(() => "a grant"),
 *   Effect.catchReason("GrantError", "Malformed", () => Effect.succeed("not a grant"))
 * )
 *
 * await Effect.runPromise(program) // => "not a grant"
 * ```
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
