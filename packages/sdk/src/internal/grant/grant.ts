import * as Effect from "effect/Effect"
import * as Result from "effect/Result"
import * as Address from "ox/Address"
import * as SignatureErc6492 from "ox/erc6492/SignatureErc6492"
import * as Hex from "ox/Hex"

import * as AccountError from "../../accounts/AccountError.ts"
import type { SmartAccount } from "../../accounts/SmartAccount.ts"
import * as ChainError from "../../ChainError.ts"
import * as GrantError from "../../GrantError.ts"
import * as SessionError from "../../SessionError.ts"
import { decodeIsPermissionEnabled, encodeEnableSessions, encodeIsPermissionEnabled } from "../core/grant/enable.ts"
import * as core from "../core/grant/grant.ts"
import { multichainDigest, sessionDigest, toTypedData } from "../core/grant/typedData.ts"
import { secondsFromMillis } from "../core/session.ts"
import { compile, permissionId } from "../core/session/compile.ts"
import { describe } from "../core/session/describe.ts"
import type { Session } from "../core/session/session.ts"
import { validate } from "../core/session/validate.ts"
import { contracts } from "../session/contracts.ts"
import { annotate, chainIdsOf, ofGrant, traced } from "../span.ts"
import { call, code, type ReadClient, verifyHash } from "../viem/client.ts"
import {
  type BundlerClient,
  sendUserOperation,
  type TransactionReceipt,
  waitForUserOperationReceipt
} from "../viem/smartAccount.ts"

/**
 * A grant before the owner signs it: everything but the signatures, and the typed data to sign.
 */
export interface Prepared {
  readonly account: core.Grant["account"]
  readonly accountType: core.GrantAccountType
  readonly session: Session
  readonly chains: ReadonlyArray<Omit<core.GrantChain, "signature">>
  readonly typedData: TypedData
}

/**
 * EIP-712 typed data, in the shape viem's `signTypedData` takes.
 */
export interface TypedData {
  readonly domain: { readonly name: string; readonly version: string }
  readonly types: { readonly [name: string]: ReadonlyArray<{ readonly name: string; readonly type: string }> }
  readonly primaryType: string
  readonly message: { readonly [field: string]: unknown }
}

const refOf = (account: SmartAccount): AccountError.Options["account"] => ({
  type: account.namera?.type ?? "unknown",
  address: account.address
})

const chainIdOf = (account: SmartAccount): Effect.Effect<number, AccountError.AccountError> => {
  const id = account.client.chain?.id
  return id === undefined
    ? Effect.fail(AccountError.invalidOptions({ account: refOf(account), detail: "the account's client has no chain" }))
    : Effect.succeed(id)
}

/** The accounts of a grant, one per chain, at one address. */
const accountsOf = Effect.fnUntraced(function*(
  input: SmartAccount | ReadonlyArray<SmartAccount>
): Effect.fn.Return<ReadonlyArray<SmartAccount>, AccountError.AccountError> {
  const accounts = Array.isArray(input) ? input : [input as SmartAccount]
  const [first] = accounts
  if (first === undefined) {
    return yield* AccountError.invalidOptions({ account: { type: "unknown" }, detail: "a grant needs an account" })
  }
  const seen = new Set<number>()
  for (const account of accounts) {
    if (account.namera === undefined) {
      return yield* AccountError.notSupported({ account: refOf(account), detail: "build the account with Namera" })
    }
    if (!Address.isEqual(account.address, first.address) || account.namera.type !== first.namera!.type) {
      return yield* AccountError.invalidOptions({
        account: refOf(account),
        detail: "every account of a grant is the same account, on its own chain"
      })
    }
    const id = yield* chainIdOf(account)
    if (seen.has(id)) {
      return yield* AccountError.invalidOptions({ account: refOf(account), detail: `two accounts on chain ${id}` })
    }
    seen.add(id)
  }
  return accounts
})

/** Refuses a session `Session.validate` reports errors for. @internal */
export const requireValid = (session: Session, account: Hex.Hex): Effect.Effect<void, SessionError.SessionError> => {
  const validation = validate(session, { contracts, now: secondsFromMillis(Date.now()), account })
  return validation.ok ? Effect.void : Effect.fail(SessionError.invalidSession(validation.problems))
}

/** Smart Sessions' enable nonce of a session on an account. @internal */
export const readNonce = (client: ReadClient, id: Hex.Hex, account: Hex.Hex) =>
  call(client, { to: contracts.smartSession, data: core.encodeGetNonce(id, account) }).pipe(
    Effect.map((result) => (result === undefined || result === "0x" ? BigInt(0) : core.decodeGetNonce(result)))
  )

/** Everything a grant needs but the signatures. @internal */
export const prepare = Effect.fnUntraced(function*(options: {
  readonly account: SmartAccount | ReadonlyArray<SmartAccount>
  readonly session: Session
}): Effect.fn.Return<Prepared, AccountError.AccountError | ChainError.ChainError | SessionError.SessionError> {
  const accounts = yield* accountsOf(options.account)
  const first = accounts[0]!
  yield* requireValid(options.session, first.address)

  const id = permissionId(options.session, contracts)
  yield* annotate({
    chainId: chainIdsOf(accounts.map((account) => account.client)),
    accountType: first.namera?.type,
    grantId: id
  })
  const chains: Array<Prepared["chains"][number]> = []
  for (const account of accounts) {
    const nonce = yield* readNonce(account.client, id, account.address)
    const chainId = account.client.chain!.id
    chains.push({
      chain: core.caip2(chainId),
      contracts,
      nonce,
      sessionDigest: sessionDigest({
        chainId,
        account: account.address,
        compiled: compile(options.session, contracts),
        smartSession: contracts.smartSession,
        nonce
      })
    })
  }

  const deployed = (yield* code(first.client, first.address)) !== undefined
  const factory = deployed
    ? undefined
    : yield* Effect.tryPromise({
      try: () => first.getFactoryArgs(),
      catch: (cause) =>
        AccountError.invalidOptions({ account: refOf(first), detail: "the account has no factory call", cause })
    })
  const grant = {
    account: `eip155:${first.client.chain!.id}:${first.address}` as const,
    session: options.session,
    chains: chains.map((chain) => ({ ...chain, signature: "0x" as Hex.Hex }))
  }
  return {
    account: grant.account,
    accountType: {
      type: first.namera!.type,
      version: first.namera!.version,
      ...(factory?.factory === undefined || factory.factoryData === undefined
        ? {}
        : { deployment: { factory: factory.factory, factoryData: factory.factoryData } })
    },
    session: options.session,
    chains,
    typedData: toTypedData(core.entries(grant))
  }
}, traced("Namera.Grant.prepare"))

// Grants keep the raw ERC-1271 signature: an undeployed account's signer wraps it for ERC-6492, which Smart Sessions'
// on-chain check (after the account is deployed) would refuse. `verify` wraps it again while the account is undeployed.
const unwrapped = (signature: Hex.Hex): Hex.Hex =>
  SignatureErc6492.validate(signature) ? SignatureErc6492.unwrap(signature).signature : signature

/** Assembles a grant from a prepared one and the owner's signatures. @internal */
export const from = (
  prepared: Prepared & {
    readonly signature?: Hex.Hex | undefined
    readonly signatures?: { readonly [chainId: number]: Hex.Hex } | undefined
  }
): Result.Result<core.Grant, GrantError.GrantError> => {
  const chains: Array<core.GrantChain> = []
  for (const chain of prepared.chains) {
    const signature = prepared.signatures?.[core.chainId(chain.chain)] ?? prepared.signature
    if (signature === undefined || !Hex.validate(signature) || Hex.size(signature) === 0) {
      return Result.fail(GrantError.make(new GrantError.InvalidSignature({ chain: chain.chain })))
    }
    chains.push({ ...chain, signature: unwrapped(signature) })
  }
  return Result.succeed({
    version: 1,
    namespace: "eip155",
    id: permissionId(prepared.session, contracts),
    account: prepared.account,
    accountType: prepared.accountType,
    session: prepared.session,
    chains,
    summary: describe(prepared.session)
  })
}

const signTypedData = (account: SmartAccount, typedData: Prepared["typedData"]) =>
  Effect.tryPromise({
    try: () => account.signTypedData(typedData as never),
    catch: (cause) =>
      AccountError.isAccountError(cause)
        ? cause
        : AccountError.signingFailed({ account: refOf(account), detail: "the owner did not sign the grant", cause })
  })

/**
 * Signs a prepared grant with its accounts, once per chain: Kernel binds the chain in its ERC-1271 domain.
 *
 * @internal
 */
export const create = Effect.fnUntraced(function*(options: {
  readonly account: SmartAccount | ReadonlyArray<SmartAccount>
  readonly session: Session
}): Effect.fn.Return<
  core.Grant,
  AccountError.AccountError | ChainError.ChainError | GrantError.GrantError | SessionError.SessionError
> {
  const accounts = yield* accountsOf(options.account)
  const prepared = yield* prepare(options)
  yield* annotate({
    chainId: chainIdsOf(accounts.map((account) => account.client)),
    accountType: prepared.accountType.type,
    grantId: permissionId(options.session, contracts)
  })

  const signatures: Record<number, Hex.Hex> = {}
  for (const account of accounts) {
    signatures[account.client.chain!.id] = yield* signTypedData(account, prepared.typedData)
  }
  return yield* Effect.fromResult(from({ ...prepared, signatures }))
}, traced("Namera.Grant.create"))

const withoutSignature = (chain: Prepared["chains"][number]): core.GrantChain => ({ ...chain, signature: "0x" })

/** The Namera account of a bundler client. @internal */
export const bundlerAccount = (client: BundlerClient): Effect.Effect<SmartAccount, AccountError.AccountError> =>
  client.account === undefined || !("namera" in client.account)
    ? Effect.fail(
      AccountError.notSupported({ account: { type: "unknown" }, detail: "the bundler client has no Namera account" })
    )
    : Effect.succeed(client.account as SmartAccount)

/** Enables the session from the owner's account, returning the user operation's hash. @internal */
export const install = Effect.fnUntraced(function*(
  client: BundlerClient,
  options: { readonly session: Session }
): Effect.fn.Return<Hex.Hex, AccountError.AccountError | ChainError.ChainError | SessionError.SessionError> {
  const account = yield* bundlerAccount(client)
  yield* requireValid(options.session, account.address)
  yield* annotate({
    chainId: chainIdsOf(client),
    accountType: account.namera?.type,
    grantId: permissionId(options.session, contracts)
  })
  return yield* sendUserOperation(client, {
    account,
    calls: [{ to: contracts.smartSession, data: encodeEnableSessions([compile(options.session, contracts)]) }]
  })
}, traced("Namera.Grant.install"))

/**
 * Enables the session and waits for it, returning the receipt and the grant of the installed session: its chains
 * carry no signature, since the session is already enabled there.
 *
 * @internal
 */
export const installSync = Effect.fnUntraced(function*(
  client: BundlerClient,
  options: { readonly session: Session }
): Effect.fn.Return<
  { readonly grant: core.Grant; readonly receipt: TransactionReceipt },
  AccountError.AccountError | ChainError.ChainError | SessionError.SessionError
> {
  const account = yield* bundlerAccount(client)
  const prepared = yield* prepare({ account, session: options.session })
  yield* annotate({
    chainId: chainIdsOf(client),
    accountType: prepared.accountType.type,
    grantId: permissionId(options.session, contracts)
  })
  const hash = yield* install(client, options)
  const { receipt, success } = yield* waitForUserOperationReceipt(client, hash)
  if (!success) {
    return yield* ChainError.reverted({
      method: "eth_sendUserOperation",
      chainId: client.chain?.id,
      detail: `user operation ${hash} reverted`
    })
  }
  const grant: core.Grant = {
    version: 1,
    namespace: "eip155",
    id: permissionId(options.session, contracts),
    account: prepared.account,
    accountType: prepared.accountType,
    session: options.session,
    chains: prepared.chains.map(withoutSignature),
    summary: describe(options.session)
  }
  return { grant, receipt }
}, traced("Namera.Grant.installSync"))

/**
 * Checks a grant on the client's chain: every chain's digest against its session, then the owner's signature on
 * this chain through the account (ERC-1271, or ERC-6492 while undeployed), or, for an installed grant without a
 * signature, that the session is enabled.
 *
 * @internal
 */
export const verify = Effect.fnUntraced(function*(
  client: ReadClient,
  grant: core.Grant
): Effect.fn.Return<void, ChainError.ChainError | GrantError.GrantError> {
  yield* annotate({ chainId: chainIdsOf(client), ...ofGrant(grant) })
  const chainId = client.chain?.id
  const chain = grant.chains.find((entry) => core.chainId(entry.chain) === chainId)
  if (chain === undefined) {
    return yield* GrantError.make(new GrantError.ChainNotCovered({ chain: core.caip2(chainId ?? 0) }))
  }
  const entries = core.entries(grant)
  for (const [index, entry] of entries.entries()) {
    if (sessionDigest(entry) !== grant.chains[index]!.sessionDigest.toLowerCase()) {
      return yield* GrantError.make(new GrantError.DigestMismatch({ chain: grant.chains[index]!.chain }))
    }
  }

  const address = core.accountAddress(grant)
  const invalid = GrantError.make(new GrantError.InvalidSignature({ chain: chain.chain }))
  if (chain.signature === "0x") {
    const enabled = yield* call(client, {
      to: chain.contracts.smartSession,
      data: encodeIsPermissionEnabled(grant.id, address)
    })
    if (enabled === undefined || enabled === "0x" || !decodeIsPermissionEnabled(enabled)) return yield* invalid
    return
  }
  const deployment = grant.accountType.deployment
  const undeployed = (yield* code(client, address)) === undefined
  const signature = undeployed && deployment !== undefined
    ? SignatureErc6492.wrap({ to: deployment.factory, data: deployment.factoryData, signature: chain.signature })
    : chain.signature
  const valid = yield* verifyHash(client, { address, hash: multichainDigest(entries), signature })
  if (!valid) return yield* invalid
}, traced("Namera.Grant.verify"))
