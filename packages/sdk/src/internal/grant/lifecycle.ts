import * as Effect from "effect/Effect"
import * as Result from "effect/Result"
import * as Address from "ox/Address"
import type * as Hex from "ox/Hex"

import * as AccountError from "../../accounts/AccountError.ts"
import type { SmartAccount } from "../../accounts/SmartAccount.ts"
import * as ChainError from "../../ChainError.ts"
import * as GrantError from "../../GrantError.ts"
import * as SessionError from "../../SessionError.ts"
import type { Call } from "../core/account/erc7579.ts"
import * as core from "../core/grant/grant.ts"
import { encodeRemoveSession, encodeRevokeEnableSignature, encodeUpdate } from "../core/grant/lifecycle.ts"
import { sessionDigest } from "../core/grant/typedData.ts"
import { compile } from "../core/session/compile.ts"
import { describe } from "../core/session/describe.ts"
import type { Policy } from "../core/session/policy.ts"
import { canonical, make, type Session } from "../core/session/session.ts"
import {
  type BundlerClient,
  sendUserOperation,
  type TransactionReceipt,
  waitForUserOperationReceipt
} from "../viem/smartAccount.ts"
import { bundlerAccount, readNonce, requireValid } from "./grant.ts"
import { isEnabled } from "./state.ts"
import { chainOf } from "./status.ts"

// The owner's changes to a grant after it was made, each an owner operation through the owner's bundler client (one
// per chain): revoking it, and updating its session's policies in place.

/** The owner account of a bundler client, which must be the grant's account. */
const ownerOf = Effect.fnUntraced(function*(
  client: BundlerClient,
  grant: core.Grant
): Effect.fn.Return<SmartAccount, AccountError.AccountError> {
  const account = yield* bundlerAccount(client)
  if (!Address.isEqual(account.address, core.accountAddress(grant))) {
    return yield* AccountError.invalidOptions({
      account: { type: grant.accountType.type, address: account.address },
      detail: `the bundler client's account is not the grant's account ${core.accountAddress(grant)}`
    })
  }
  return account
})

const send = (client: BundlerClient, account: SmartAccount, calls: ReadonlyArray<Call>) =>
  sendUserOperation(client, { account, calls })

const settle = Effect.fnUntraced(function*(
  client: BundlerClient,
  hash: Hex.Hex
): Effect.fn.Return<TransactionReceipt, ChainError.ChainError> {
  const { receipt, success } = yield* waitForUserOperationReceipt(client, hash)
  if (!success) {
    return yield* ChainError.reverted({
      method: "eth_sendUserOperation",
      chainId: client.chain?.id,
      detail: `user operation ${hash} reverted`
    })
  }
  return receipt
})

/**
 * The owner's call that revokes the grant, to batch yourself: `removeSession`, which removes an enabled session and
 * spends the enable nonce, so an unused grant can't enable it either.
 *
 * @internal
 */
export const revokeCalls = (grant: core.Grant): ReadonlyArray<Call> => [{
  to: grant.chains[0]!.contracts.smartSession,
  data: encodeRemoveSession(grant.id)
}]

/**
 * Revokes the grant on each client's chain: removes an enabled session, revokes an unused grant's enable signature,
 * and sends nothing where it is already revoked (`undefined`).
 *
 * @internal
 */
export const revoke = Effect.fnUntraced(function*(
  clients: ReadonlyArray<BundlerClient>,
  grant: core.Grant
): Effect.fn.Return<
  ReadonlyArray<Hex.Hex | undefined>,
  AccountError.AccountError | ChainError.ChainError | GrantError.GrantError
> {
  const hashes: Array<Hex.Hex | undefined> = []
  for (const client of clients) {
    const account = yield* ownerOf(client, grant)
    const chain = yield* chainOf(client, grant)
    const to = chain.contracts.smartSession
    // Reads go through the account's own client: a bundler endpoint may serve only the bundler methods.
    const reader = account.client
    if (yield* isEnabled(reader, grant, chain)) {
      hashes.push(yield* send(client, account, [{ to, data: encodeRemoveSession(grant.id) }]))
      continue
    }
    const unused = chain.signature !== "0x" && (yield* readNonce(reader, grant.id, account.address)) === chain.nonce
    hashes.push(
      unused ? yield* send(client, account, [{ to, data: encodeRevokeEnableSignature(grant.id) }]) : undefined
    )
  }
  return hashes
})

/**
 * Revokes the grant and waits: the receipt of each chain's operation, `undefined` where nothing was sent.
 *
 * @internal
 */
export const revokeSync = Effect.fnUntraced(function*(
  clients: ReadonlyArray<BundlerClient>,
  grant: core.Grant
): Effect.fn.Return<
  ReadonlyArray<TransactionReceipt | undefined>,
  AccountError.AccountError | ChainError.ChainError | GrantError.GrantError
> {
  const hashes = yield* revoke(clients, grant)
  return yield* Effect.forEach(
    hashes,
    (hash, index) => hash === undefined ? Effect.succeed(undefined) : settle(clients[index]!, hash)
  )
})

/**
 * The grant's session with `remove` taken out (each must be one of its policies) and `add` put in: same signer, salt
 * and window, so the same permission id.
 *
 * @internal
 */
export const updatedSession = (
  grant: core.Grant,
  options: { readonly add?: ReadonlyArray<Policy> | undefined; readonly remove?: ReadonlyArray<Policy> | undefined }
): Result.Result<Session, GrantError.GrantError | SessionError.SessionError> => {
  const removed = (options.remove ?? []).map(canonical)
  const missing = removed.findIndex((key) => !grant.session.policies.some((policy) => canonical(policy) === key))
  if (missing !== -1) return Result.fail(GrantError.make(new GrantError.PolicyNotFound({ index: missing })))
  const { session } = grant
  const result = make({
    signer: session.signer,
    policies: [...session.policies.filter((policy) => !removed.includes(canonical(policy))), ...(options.add ?? [])],
    validAfter: session.validAfter,
    validUntil: session.validUntil,
    salt: session.salt,
    sponsored: session.sponsored,
    unsafe: session.unsafe,
    label: session.label
  })
  return "problems" in result
    ? Result.fail(SessionError.invalidSession(result.problems))
    : Result.succeed(result.session)
}

/**
 * The owner's calls that update an enabled session to the grant's session with `add` and `remove`, to batch yourself,
 * and the updated session.
 *
 * @internal
 */
export const updateCalls = (
  grant: core.Grant,
  options: { readonly add?: ReadonlyArray<Policy> | undefined; readonly remove?: ReadonlyArray<Policy> | undefined }
): Result.Result<
  { readonly calls: ReadonlyArray<Call>; readonly session: Session },
  GrantError.GrantError | SessionError.SessionError
> =>
  Result.map(updatedSession(grant, options), (session) => {
    const { contracts } = grant.chains[0]!
    const data = encodeUpdate({
      permissionId: grant.id,
      previous: compile(grant.session, contracts),
      next: compile(session, contracts),
      enabled: true
    })
    return { calls: data.map((entry) => ({ to: contracts.smartSession, data: entry })), session }
  })

/**
 * Updates the grant's session on each client's chain: disables what is removed, enables the updated session (adding
 * what is new, reconfiguring what stays) and revokes the old enable signature, so the old grant can't widen the
 * session again. Returns the hashes and the updated grant, installed on those chains (no enable signature).
 *
 * @internal
 */
export const update = Effect.fnUntraced(function*(
  clients: ReadonlyArray<BundlerClient>,
  options: {
    readonly grant: core.Grant
    readonly add?: ReadonlyArray<Policy> | undefined
    readonly remove?: ReadonlyArray<Policy> | undefined
  }
): Effect.fn.Return<
  { readonly hashes: ReadonlyArray<Hex.Hex>; readonly grant: core.Grant },
  AccountError.AccountError | ChainError.ChainError | GrantError.GrantError | SessionError.SessionError
> {
  const { grant } = options
  const session = yield* Effect.fromResult(updatedSession(grant, options))
  yield* requireValid(session, core.accountAddress(grant))

  const hashes: Array<Hex.Hex> = []
  const chains: Array<core.GrantChain> = []
  for (const client of clients) {
    const account = yield* ownerOf(client, grant)
    const chain = yield* chainOf(client, grant)
    const { contracts } = chain
    const enabled = yield* isEnabled(account.client, grant, chain)
    const nonce = yield* readNonce(account.client, grant.id, account.address)
    const next = compile(session, contracts)
    const calls = encodeUpdate({ permissionId: grant.id, previous: compile(grant.session, contracts), next, enabled })
    hashes.push(yield* send(client, account, calls.map((data) => ({ to: contracts.smartSession, data }))))
    // Revoking the enable signature moved the nonce on by one.
    const after = nonce + BigInt(1)
    chains.push({
      chain: chain.chain,
      contracts,
      nonce: after,
      sessionDigest: sessionDigest({
        chainId: core.chainId(chain.chain),
        account: account.address,
        compiled: next,
        smartSession: contracts.smartSession,
        nonce: after
      }),
      signature: "0x"
    })
  }
  return { hashes, grant: { ...grant, session, chains, summary: describe(session) } }
})

/**
 * Updates the grant and waits: the receipts and the updated grant.
 *
 * @internal
 */
export const updateSync = Effect.fnUntraced(function*(
  clients: ReadonlyArray<BundlerClient>,
  options: Parameters<typeof update>[1]
): Effect.fn.Return<
  { readonly receipts: ReadonlyArray<TransactionReceipt>; readonly grant: core.Grant },
  AccountError.AccountError | ChainError.ChainError | GrantError.GrantError | SessionError.SessionError
> {
  const { grant, hashes } = yield* update(clients, options)
  const receipts = yield* Effect.forEach(hashes, (hash, index) => settle(clients[index]!, hash))
  return { receipts, grant }
})
