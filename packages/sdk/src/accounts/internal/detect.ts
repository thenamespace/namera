import * as External from "@namera-ai/contracts/External"
import * as Effect from "effect/Effect"

import type * as ChainError from "../../ChainError.ts"
import { decodeRootValidator, encodeRootValidator } from "../../internal/core/account/kernel.ts"
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
import * as Passkeys from "./passkeys.ts"
import { isSessionsInstalled } from "./sessions.ts"
import type { NameraSmartAccount } from "./smartAccount.ts"

/** What `detect` found at an address. */
export type Detected =
  | {
    readonly type: "kernel"
    readonly version: string
    readonly eip7702: boolean
    readonly implementation: Hex
    readonly sessionsInstalled: boolean
  }
  | { readonly type: "unsupported"; readonly implementation: Hex | undefined }
  | { readonly type: "undeployed" }

// The ERC-1967 implementation slot of Kernel's proxy.
const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
const DELEGATION_PREFIX = "0xef0100"

const sameAddress = (a: Hex, b: Hex) => a.toLowerCase() === b.toLowerCase()

// A storage word holding an address, or `undefined` when it is empty.
const readAddress = (client: ReadClient, address: Hex, slot: Hex) =>
  storageAt(client, address, slot).pipe(
    Effect.map((
      word
    ) => (word === undefined || BigInt(word) === BigInt(0) ? undefined : (`0x${word.slice(-40)}` as Hex)))
  )

const kernelVersion = (implementation: Hex): string | undefined =>
  Object.entries(External.kernel).find(([, contracts]) => sameAddress(contracts.implementation, implementation))?.[0]

/** Reads whether a Kernel 3.3 account, deployed or through EIP-7702, lives at an address. @internal */
export const detect = Effect.fnUntraced(function*(
  client: ReadClient,
  address: Hex
): Effect.fn.Return<Detected, ChainError.ChainError> {
  const deployed = yield* code(client, address)
  if (deployed === undefined) return { type: "undeployed" }

  const eip7702 = deployed.startsWith(DELEGATION_PREFIX)
  const implementation = eip7702
    ? (`0x${deployed.slice(DELEGATION_PREFIX.length, DELEGATION_PREFIX.length + 40)}` as Hex)
    : yield* readAddress(client, address, IMPLEMENTATION_SLOT)
  if (implementation === undefined) return { type: "unsupported", implementation: undefined }

  const version = kernelVersion(implementation)
  if (version === undefined) return { type: "unsupported", implementation }
  return {
    type: "kernel",
    version,
    eip7702,
    implementation,
    sessionsInstalled: yield* isSessionsInstalled(client, address)
  }
})

// Whether `validator` is a Kernel account's root validator, rather than one installed next to it.
const isKernelRoot = (client: AccountClient, address: Hex, validator: Hex) =>
  call(client, { to: address, data: encodeRootValidator }).pipe(
    Effect.map((result) => {
      const root = result === undefined || result === "0x" ? undefined : decodeRootValidator(result)
      return root === undefined || sameAddress(root, validator)
    })
  )

/** The options of `fromAddress`. */
export interface FromAddressOptions {
  readonly client: AccountClient
  readonly address: Hex
  readonly owner?: Owner | Passkeys.Owner | undefined
  readonly owners?: ReadonlyArray<Owner> | ReadonlyArray<WebAuthnAccount> | undefined
}

/** Builds the Namera account for an existing Kernel account `detect` recognised. @internal */
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
    return yield* Kernel.fromValidator(
      {
        client: options.client,
        address: options.address,
        sessions: false,
        owner: passkeys,
        version: detected.version as Kernel.Version
      },
      yield* isKernelRoot(options.client, options.address, Passkeys.validator)
    )
  }
  const [ecdsaOwner] = owners as ReadonlyArray<Owner> as [Owner]
  const version = detected.version as Kernel.Version
  if (!detected.eip7702) {
    return yield* Kernel.fromValidator(
      { client: options.client, owner: ecdsaOwner, version, address: options.address, sessions: false },
      yield* isKernelRoot(options.client, options.address, External.kernel[version].ecdsaValidator)
    )
  }
  if (ecdsaOwner.type !== "local" || !sameAddress(ecdsaOwner.address, options.address)) {
    return yield* AccountError.invalidOptions({
      account: { type: "kernel", address: options.address },
      detail: "an EIP-7702 account's owner is its own local key"
    })
  }
  return yield* Kernel.fromEip7702({
    client: options.client,
    owner: ecdsaOwner as PrivateKeyAccount,
    version,
    sessions: false
  })
})
