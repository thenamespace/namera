import * as External from "@namera-ai/contracts/External"
import * as Effect from "effect/Effect"

import type * as ChainError from "../../ChainError.ts"
import { decodeAccountId, encodeAccountId } from "../../internal/core/account/erc7579.ts"
import {
  type AccountClient,
  call,
  code,
  type Hex,
  type Owner,
  type PrivateKeyAccount,
  type ReadClient,
  storageAt
} from "../../internal/viem/client.ts"
import { isWebAuthnAccount, type WebAuthnAccount } from "../../internal/viem/signing.ts"
import * as AccountError from "../AccountError.ts"
import * as Kernel from "./kernel.ts"
import * as Nexus from "./nexus.ts"
import * as Passkeys from "./passkeys.ts"
import * as Safe7579 from "./safe7579.ts"
import { isSessionsInstalled } from "./sessions.ts"
import type { NameraSmartAccount } from "./smartAccount.ts"

/** What `detect` found at an address. */
export type Detected =
  | {
    readonly type: "kernel" | "nexus" | "safe7579"
    readonly version: string
    readonly eip7702: boolean
    readonly implementation: Hex
    readonly sessionsInstalled: boolean
  }
  | { readonly type: "unsupported"; readonly implementation: Hex | undefined }
  | { readonly type: "undeployed" }

// The ERC-1967 implementation slot (Kernel, Nexus) and a Safe proxy's slot 0 (its singleton).
const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
const SAFE_SINGLETON_SLOT = "0x0000000000000000000000000000000000000000000000000000000000000000"
const DELEGATION_PREFIX = "0xef0100"

const sameAddress = (a: Hex, b: Hex) => a.toLowerCase() === b.toLowerCase()

// A storage word holding an address, or `undefined` when it is empty.
const readAddress = (client: ReadClient, address: Hex, slot: Hex) =>
  storageAt(client, address, slot).pipe(
    Effect.map((
      word
    ) => (word === undefined || BigInt(word) === BigInt(0) ? undefined : (`0x${word.slice(-40)}` as Hex)))
  )

const supported = (
  implementation: Hex
): { readonly type: "kernel" | "nexus"; readonly version: string } | undefined => {
  for (const [version, contracts] of Object.entries(External.kernel)) {
    if (sameAddress(contracts.implementation, implementation)) return { type: "kernel", version }
  }
  for (const [version, contracts] of Object.entries(External.nexus)) {
    if (sameAddress(contracts.implementation, implementation)) return { type: "nexus", version }
  }
  return undefined
}

/** Reads which supported account, if any, lives at an address. @internal */
export const detect = Effect.fnUntraced(function*(
  client: ReadClient,
  address: Hex
): Effect.fn.Return<Detected, ChainError.ChainError> {
  const deployed = yield* code(client, address)
  if (deployed === undefined) return { type: "undeployed" }

  const eip7702 = deployed.startsWith(DELEGATION_PREFIX)
  const implementation = eip7702
    ? (`0x${deployed.slice(DELEGATION_PREFIX.length, DELEGATION_PREFIX.length + 40)}` as Hex)
    : (yield* readAddress(client, address, IMPLEMENTATION_SLOT))
      ?? (yield* readAddress(client, address, SAFE_SINGLETON_SLOT))
  if (implementation === undefined) return { type: "unsupported", implementation: undefined }

  const known = supported(implementation)
  if (known !== undefined) {
    return { ...known, eip7702, implementation, sessionsInstalled: yield* isSessionsInstalled(client, address) }
  }

  // A Safe is a Safe7579 account when the adapter answers its ERC-7579 `accountId`; a Safe without it reverts.
  for (const [version, contracts] of Object.entries(External.safe7579)) {
    if (eip7702 || !sameAddress(contracts.singletonL2, implementation)) continue
    const accountId = yield* call(client, { to: address, data: encodeAccountId }).pipe(
      Effect.orElseSucceed(() => undefined)
    )
    if (accountId !== undefined && accountId !== "0x" && decodeAccountId(accountId).startsWith("rhinestone.safe7579")) {
      return {
        type: "safe7579",
        version,
        eip7702,
        implementation,
        sessionsInstalled: yield* isSessionsInstalled(client, address)
      }
    }
  }
  return { type: "unsupported", implementation }
})

/** The options of `fromAddress`. */
export interface FromAddressOptions {
  readonly client: AccountClient
  readonly address: Hex
  readonly owner?: Owner | Passkeys.Owner | undefined
  readonly owners?: ReadonlyArray<Owner> | ReadonlyArray<WebAuthnAccount> | undefined
}

/** Builds the Namera account for an existing account, choosing its type from `detect`. @internal */
export const fromAddress = Effect.fnUntraced(function*(
  options: FromAddressOptions
): Effect.fn.Return<NameraSmartAccount, AccountError.AccountError | ChainError.ChainError> {
  const ref = { type: "unknown", address: options.address } as const
  const owners: ReadonlyArray<Owner | Passkeys.Owner> = options.owners ??
    (options.owner === undefined ? [] : [options.owner])
  const [owner] = owners
  if (owner === undefined) {
    return yield* AccountError.invalidOptions({ account: ref, detail: "an owner is required" })
  }

  const detected = yield* detect(options.client, options.address)
  switch (detected.type) {
    case "undeployed":
      return yield* AccountError.notSupported({ account: ref, detail: "no account is deployed at the address" })
    case "unsupported":
      return yield* AccountError.notSupported({ account: ref, implementation: detected.implementation })
    case "kernel":
    case "nexus":
    case "safe7579":
      break
  }

  // Passkey owners sign through WebAuthnValidator, which an EIP-7702 account cannot have as its owner.
  if (owners.some((owner) => Passkeys.isOwner(owner))) {
    if (detected.eip7702) {
      return yield* AccountError.invalidOptions({
        account: { type: detected.type, address: options.address },
        detail: "an EIP-7702 account's owner is its own local key, not a passkey"
      })
    }
    const passkeys = owners.length === 1 && Passkeys.isOwner(owner)
      ? owner
      : { passkeys: owners.filter((owner): owner is WebAuthnAccount => isWebAuthnAccount(owner as never)) }
    const common = { client: options.client, address: options.address, sessions: false } as const
    switch (detected.type) {
      case "kernel":
        return yield* Kernel.from({ ...common, owner: passkeys, version: detected.version as never })
      case "nexus":
        return yield* Nexus.from({ ...common, owner: passkeys, version: detected.version as never })
      case "safe7579": {
        const group = "passkeys" in passkeys ? passkeys : { passkeys: [passkeys], threshold: 1 }
        return yield* Safe7579.from({ ...common, owners: group.passkeys, threshold: group.threshold })
      }
    }
  }
  const ecdsaOwners = owners as ReadonlyArray<Owner>

  switch (detected.type) {
    case "safe7579":
      return yield* Safe7579.from({
        client: options.client,
        owners: ecdsaOwners,
        address: options.address,
        sessions: false
      })
    case "kernel":
    case "nexus": {
      const build = detected.type === "kernel" ? Kernel : Nexus
      const version = detected.version as never
      const [ecdsaOwner] = ecdsaOwners as [Owner]
      if (!detected.eip7702) {
        return yield* build.from({
          client: options.client,
          owner: ecdsaOwner,
          version,
          address: options.address,
          sessions: false
        })
      }
      if (ecdsaOwner.type !== "local" || !sameAddress(ecdsaOwner.address, options.address)) {
        return yield* AccountError.invalidOptions({
          account: { type: detected.type, address: options.address },
          detail: "an EIP-7702 account's owner is its own local key"
        })
      }
      return yield* build.fromEip7702({
        client: options.client,
        owner: ecdsaOwner as PrivateKeyAccount,
        version,
        sessions: false
      })
    }
  }
})
