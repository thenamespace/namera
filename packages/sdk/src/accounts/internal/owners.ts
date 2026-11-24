import * as External from "@namera-ai/contracts/External"
import * as Effect from "effect/Effect"

import * as ChainError from "../../ChainError.ts"
import {
  type Call,
  decodeIsModuleInstalled,
  encodeIsModuleInstalled,
  MODULE_TYPE_VALIDATOR
} from "../../internal/core/account/erc7579.ts"
import * as Kernel from "../../internal/core/account/kernel.ts"
import * as WebAuthn from "../../internal/core/account/webauthn.ts"
import { call, type Hex, type Owner, type ReadClient } from "../../internal/viem/client.ts"
import {
  type BundlerClient,
  sendUserOperation,
  type TransactionReceipt,
  waitForUserOperationReceipt
} from "../../internal/viem/smartAccount.ts"
import * as AccountError from "../AccountError.ts"
import { detect } from "./detect.ts"
import * as Passkeys from "./passkeys.ts"
import type { NameraSmartAccount } from "./smartAccount.ts"

/** An owner as the owner functions take it: a key (an account or its address) or a passkey (its public key). */
export type OwnerRef = Hex | Owner | { readonly publicKey: Hex }

/** One owner validator of an account, with its owners and how many must sign. */
export type OwnerSet =
  | {
    readonly type: "key"
    readonly validator: Hex
    readonly owners: ReadonlyArray<Hex>
    readonly threshold: number
  }
  | {
    readonly type: "passkey"
    readonly validator: Hex
    readonly passkeys: ReadonlyArray<{
      readonly credentialId: Hex
      readonly publicKey: Hex
      readonly requireUserVerification: boolean
    }>
    readonly threshold: number
  }

type Kind = { readonly type: "key"; readonly address: Hex } | {
  readonly type: "passkey"
  readonly publicKey: Hex
  readonly credentialId: Hex
}

const kindOf = (owner: OwnerRef): Kind => {
  if (typeof owner === "string") return { type: "key", address: owner }
  if ("address" in owner) return { type: "key", address: owner.address }
  return { type: "passkey", publicKey: owner.publicKey, credentialId: WebAuthn.credentialId(owner.publicKey) }
}

const same = (a: Hex, b: Hex) => BigInt(a) === BigInt(b)
const zeroAddress: Hex = "0x0000000000000000000000000000000000000000"

// A view that reverts (no such function, no code) reads as `undefined`.
const read = (client: ReadClient, to: Hex, data: Hex) =>
  call(client, { to, data }).pipe(
    Effect.map((result) => (result === undefined || result === "0x" ? undefined : result)),
    Effect.orElseSucceed(() => undefined)
  )

const isInstalled = (client: ReadClient, account: Hex, validator: Hex) =>
  read(client, account, encodeIsModuleInstalled(MODULE_TYPE_VALIDATOR, validator)).pipe(
    Effect.map((result) => result !== undefined && decodeIsModuleInstalled(result))
  )

/**
 * Reads an account's owner validators and their owners: its key owner (Kernel's ECDSA validator holds one key) and its
 * passkeys. An undeployed account has none on chain yet.
 *
 * @internal
 */
export const getOwners = Effect.fnUntraced(function*(
  client: ReadClient,
  address: Hex
): Effect.fn.Return<ReadonlyArray<OwnerSet>, AccountError.AccountError | ChainError.ChainError> {
  const detected = yield* detect(client, address)
  switch (detected.type) {
    case "undeployed":
      return []
    case "unsupported":
      return yield* AccountError.notSupported({
        account: { type: "unknown", address },
        implementation: detected.implementation
      })
    case "kernel":
      break
  }

  const sets: Array<OwnerSet> = []
  if (detected.eip7702) {
    // The account's own key always signs for an EIP-7702 account.
    sets.push({ type: "key", validator: address, owners: [address], threshold: 1 })
  } else {
    const { ecdsaValidator } = External.kernel[detected.version as keyof typeof External.kernel]
    const owner = (yield* isInstalled(client, address, ecdsaValidator))
      ? yield* read(client, ecdsaValidator, Kernel.encodeEcdsaOwner(address))
      : undefined
    const decoded = owner === undefined ? zeroAddress : Kernel.decodeEcdsaOwner(owner)
    if (!same(decoded, zeroAddress)) {
      sets.push({ type: "key", validator: ecdsaValidator, owners: [decoded], threshold: 1 })
    }
  }

  if (yield* isInstalled(client, address, Passkeys.validator)) {
    const passkeys = yield* read(client, Passkeys.validator, WebAuthn.encodeGetPasskeys(address))
    const installed = passkeys === undefined ? undefined : WebAuthn.decodeGetPasskeys(passkeys)
    if (installed !== undefined && installed.passkeys.length > 0) {
      sets.push({ type: "passkey", validator: Passkeys.validator, ...installed })
    }
  }
  return sets
})

/** What the owner functions know about the account they change. */
interface Target {
  readonly account: NameraSmartAccount
  readonly ref: AccountError.Options["account"]
  readonly keys: Extract<OwnerSet, { readonly type: "key" }> | undefined
  readonly passkeys: Extract<OwnerSet, { readonly type: "passkey" }> | undefined
}

const target = Effect.fnUntraced(function*(
  account: NameraSmartAccount,
  operation: string
): Effect.fn.Return<Target, AccountError.AccountError | ChainError.ChainError> {
  const ref = { type: account.namera.type, address: account.address } as const
  const sets = yield* getOwners(account.client as ReadClient, account.address)
  if (sets.length === 0) {
    return yield* AccountError.operationNotSupported({ account: ref, operation, detail: "it is not deployed yet" })
  }
  return {
    account,
    ref,
    keys: sets.find((set) => set.type === "key") as Target["keys"],
    passkeys: sets.find((set) => set.type === "passkey") as Target["passkeys"]
  }
})

const self = (target: Target, data: Hex): Call => ({ to: target.account.address, data })

const noKeys = (target: Target, operation: string) =>
  AccountError.operationNotSupported({
    account: target.ref,
    operation,
    detail: "it has no key owners; add one with `addOwnerValidator`"
  })

const noPasskeys = (target: Target, operation: string) =>
  AccountError.operationNotSupported({
    account: target.ref,
    operation,
    detail: "it has no passkey owners; add them with `addOwnerValidator`"
  })

const singleKey = (target: Target, operation: string) =>
  AccountError.operationNotSupported({
    account: target.ref,
    operation,
    detail: "its Kernel key validator holds one key"
  })

/**
 * The calls that add a key or a passkey to the account's owner validator of that kind.
 *
 * @internal
 */
export const addOwnerCalls = Effect.fnUntraced(function*(
  account: NameraSmartAccount,
  owner: OwnerRef
): Effect.fn.Return<ReadonlyArray<Call>, AccountError.AccountError | ChainError.ChainError> {
  const operation = "add an owner"
  const t = yield* target(account, operation)
  const kind = kindOf(owner)

  if (kind.type === "passkey") {
    if (t.passkeys === undefined) return yield* noPasskeys(t, operation)
    if (t.passkeys.passkeys.some((passkey) => same(passkey.credentialId, kind.credentialId))) {
      return yield* AccountError.ownerExists({ account: t.ref, owner: kind.credentialId })
    }
    return [{
      to: t.passkeys.validator,
      data: WebAuthn.management.addPasskey({ publicKey: kind.publicKey, requireUserVerification: true })
    }]
  }

  if (t.keys === undefined) return yield* noKeys(t, operation)
  return yield* singleKey(t, operation)
})

/**
 * The calls that remove a key or a passkey from the account, keeping at least its threshold of owners.
 *
 * @internal
 */
export const removeOwnerCalls = Effect.fnUntraced(function*(
  account: NameraSmartAccount,
  owner: OwnerRef
): Effect.fn.Return<ReadonlyArray<Call>, AccountError.AccountError | ChainError.ChainError> {
  const operation = "remove an owner"
  const t = yield* target(account, operation)
  const kind = kindOf(owner)

  if (kind.type === "passkey") {
    if (t.passkeys === undefined) return yield* noPasskeys(t, operation)
    const { passkeys, threshold, validator } = t.passkeys
    if (!passkeys.some((passkey) => same(passkey.credentialId, kind.credentialId))) {
      return yield* AccountError.ownerNotFound({ account: t.ref, owner: kind.credentialId })
    }
    if (passkeys.length - 1 < threshold) {
      return yield* AccountError.thresholdUnreachable({ account: t.ref, threshold, owners: passkeys.length - 1 })
    }
    return [{ to: validator, data: WebAuthn.management.removePasskey(kind.publicKey) }]
  }

  if (t.keys === undefined) return yield* noKeys(t, operation)
  if (!t.keys.owners.some((key) => same(key, kind.address))) {
    return yield* AccountError.ownerNotFound({ account: t.ref, owner: kind.address })
  }
  return yield* singleKey(t, operation)
})

/**
 * The calls that set how many of the account's keys or passkeys must sign. `owners` picks which when it has both.
 *
 * @internal
 */
export const setThresholdCalls = Effect.fnUntraced(function*(
  account: NameraSmartAccount,
  options: { readonly threshold: number; readonly owners?: "key" | "passkey" | undefined }
): Effect.fn.Return<ReadonlyArray<Call>, AccountError.AccountError | ChainError.ChainError> {
  const operation = "set a threshold"
  const t = yield* target(account, operation)
  const type = options.owners ?? (t.passkeys !== undefined && t.keys === undefined ? "passkey" : "key")
  if (options.owners === undefined && t.passkeys !== undefined && t.keys !== undefined) {
    return yield* AccountError.invalidOptions({
      account: t.ref,
      detail: "the account has key and passkey owners: say which with `owners`"
    })
  }
  const { threshold } = options

  if (type === "passkey") {
    if (t.passkeys === undefined) return yield* noPasskeys(t, operation)
    const count = t.passkeys.passkeys.length
    if (!Number.isInteger(threshold) || threshold < 1 || threshold > count) {
      return yield* AccountError.thresholdUnreachable({ account: t.ref, threshold, owners: count })
    }
    return [{ to: t.passkeys.validator, data: WebAuthn.management.setThreshold(threshold) }]
  }

  if (t.keys === undefined) return yield* noKeys(t, operation)
  return yield* singleKey(t, operation)
})

/**
 * The calls that replace one owner with another of the same kind: the only way to change the key of Kernel's ECDSA
 * validator, which holds one key.
 *
 * @internal
 */
export const replaceOwnerCalls = Effect.fnUntraced(function*(
  account: NameraSmartAccount,
  options: { readonly owner: OwnerRef; readonly with: OwnerRef }
): Effect.fn.Return<ReadonlyArray<Call>, AccountError.AccountError | ChainError.ChainError> {
  const operation = "replace an owner"
  const t = yield* target(account, operation)
  const [old, next] = [kindOf(options.owner), kindOf(options.with)]

  if (old.type === "passkey" && next.type === "passkey") {
    if (t.passkeys === undefined) return yield* noPasskeys(t, operation)
    const { passkeys, threshold, validator } = t.passkeys
    if (!passkeys.some((passkey) => same(passkey.credentialId, old.credentialId))) {
      return yield* AccountError.ownerNotFound({ account: t.ref, owner: old.credentialId })
    }
    if (passkeys.some((passkey) => same(passkey.credentialId, next.credentialId))) {
      return yield* AccountError.ownerExists({ account: t.ref, owner: next.credentialId })
    }
    const add = {
      to: validator,
      data: WebAuthn.management.addPasskey({ publicKey: next.publicKey, requireUserVerification: true })
    }
    const remove = { to: validator, data: WebAuthn.management.removePasskey(old.publicKey) }
    // Add first so the threshold stays reachable, unless the account already holds the most passkeys it can.
    if (passkeys.length < 16) return [add, remove]
    if (passkeys.length - 1 < threshold) {
      return yield* AccountError.thresholdUnreachable({ account: t.ref, threshold, owners: passkeys.length - 1 })
    }
    return [remove, add]
  }

  if (old.type !== "key" || next.type !== "key") {
    return yield* AccountError.invalidOptions({
      account: t.ref,
      detail: "replace a key with a key or a passkey with a passkey; add another kind with `addOwnerValidator`"
    })
  }
  if (t.keys === undefined) return yield* noKeys(t, operation)
  const { owners, validator } = t.keys
  if (!owners.some((key) => same(key, old.address))) {
    return yield* AccountError.ownerNotFound({ account: t.ref, owner: old.address })
  }
  if (owners.some((key) => same(key, next.address))) {
    return yield* AccountError.ownerExists({ account: t.ref, owner: next.address })
  }
  if (same(validator, account.address)) {
    return yield* AccountError.operationNotSupported({
      account: t.ref,
      operation,
      detail: "an EIP-7702 account's owner is its own key"
    })
  }

  return Kernel.replaceEcdsaOwnerData(next.address).map((data) => ({ to: validator, data }))
})

/**
 * The calls that give the account a second kind of owner: passkeys on an account owned by a key, or a key on one
 * owned by passkeys.
 *
 * @internal
 */
export const addOwnerValidatorCalls = Effect.fnUntraced(function*(
  account: NameraSmartAccount,
  owner: Hex | Owner | Passkeys.Owner
): Effect.fn.Return<ReadonlyArray<Call>, AccountError.AccountError | ChainError.ChainError> {
  const operation = "add an owner validator"
  const t = yield* target(account, operation)

  if (typeof owner !== "string" && Passkeys.isOwner(owner)) {
    if (t.passkeys !== undefined) {
      return yield* AccountError.operationNotSupported({
        account: t.ref,
        operation,
        detail: "it already has passkey owners; add passkeys with `addOwner`"
      })
    }
    const data = Passkeys.installData(yield* Passkeys.fromOwner(owner, t.ref))
    return [self(t, Kernel.installValidatorData(Passkeys.validator, data))]
  }

  const key = kindOf(owner as Hex | Owner) as Extract<Kind, { readonly type: "key" }>
  if (t.keys !== undefined) {
    return yield* AccountError.operationNotSupported({
      account: t.ref,
      operation,
      detail: "it already has a key owner; use `addOwner` or `replaceOwner`"
    })
  }
  const { ecdsaValidator } = External.kernel[account.namera.version as keyof typeof External.kernel]
  return [self(t, Kernel.installValidatorData(ecdsaValidator, key.address))]
})

const bundlerAccount = (client: BundlerClient): Effect.Effect<NameraSmartAccount, AccountError.AccountError> =>
  client.account === undefined || !("namera" in client.account)
    ? Effect.fail(
      AccountError.notSupported({ account: { type: "unknown" }, detail: "the bundler client has no Namera account" })
    )
    : Effect.succeed(client.account as NameraSmartAccount)

/**
 * Sends the calls an owner function builds for the bundler client's account, returning the user operation hash.
 *
 * @internal
 */
export const send = Effect.fnUntraced(function*(
  client: BundlerClient,
  calls: (
    account: NameraSmartAccount
  ) => Effect.Effect<ReadonlyArray<Call>, AccountError.AccountError | ChainError.ChainError>
): Effect.fn.Return<Hex, AccountError.AccountError | ChainError.ChainError> {
  const account = yield* bundlerAccount(client)
  return yield* sendUserOperation(client, { account, calls: yield* calls(account) })
})

/**
 * Sends the calls an owner function builds and waits until the operation is included, returning its receipt.
 *
 * @internal
 */
export const sendSync = Effect.fnUntraced(function*(
  client: BundlerClient,
  calls: (
    account: NameraSmartAccount
  ) => Effect.Effect<ReadonlyArray<Call>, AccountError.AccountError | ChainError.ChainError>
): Effect.fn.Return<TransactionReceipt, AccountError.AccountError | ChainError.ChainError> {
  const hash = yield* send(client, calls)
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
