import * as External from "@namera-ai/contracts/External"
import * as SmartSession from "@namera-ai/contracts/SmartSession"
import * as Effect from "effect/Effect"
import type { Chain, Client, Hex, PrivateKeyAccount, TransactionReceipt, Transport } from "viem"
import { isAddressEqual } from "viem"
import { sendUserOperation, type SmartAccount, waitForUserOperationReceipt } from "viem/account-abstraction"
import { call, getCode, getStorageAt } from "viem/actions"
import { getAction } from "viem/utils"

import * as ChainError from "../../ChainError.ts"
import { fromUnknown } from "../../internal/chainError.ts"
import {
  type Call,
  decodeAccountId,
  decodeIsModuleInstalled,
  encodeAccountId,
  encodeIsModuleInstalled,
  MODULE_TYPE_VALIDATOR
} from "../../internal/core/account/erc7579.ts"
import * as AccountError from "../AccountError.ts"
import * as Kernel from "./kernel.ts"
import * as Nexus from "./nexus.ts"
import * as Safe7579 from "./safe7579.ts"
import type { AccountClient, NameraSmartAccount, Owner } from "./smartAccount.ts"

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

type ReadClient = Client<Transport, Chain | undefined>

const readCode = (client: ReadClient, address: Hex): Effect.Effect<Hex | undefined, ChainError.ChainError> =>
  Effect.tryPromise({ try: () => getCode(client, { address }), catch: (cause) => fromUnknown(cause, "eth_getCode") })

const readSlot = (client: ReadClient, address: Hex, slot: Hex): Effect.Effect<Hex | undefined, ChainError.ChainError> =>
  Effect.tryPromise({
    try: async () => {
      const word = await getStorageAt(client, { address, slot })
      return word === undefined || BigInt(word) === 0n ? undefined : (`0x${word.slice(-40)}` as Hex)
    },
    catch: (cause) => fromUnknown(cause, "eth_getStorageAt")
  })

// A view call that reverts (the account doesn't implement it) answers `undefined`.
const view = (client: ReadClient, to: Hex, data: Hex): Effect.Effect<Hex | undefined> =>
  Effect.tryPromise(() => call(client, { to, data })).pipe(
    Effect.map(({ data }) => data),
    Effect.orElseSucceed(() => undefined)
  )

/** Checks whether Smart Sessions is installed on the account as a validator. @internal */
export const isSessionsInstalled = Effect.fnUntraced(function*(
  client: ReadClient,
  address: Hex
): Effect.fn.Return<boolean, ChainError.ChainError> {
  const code = yield* readCode(client, address)
  if (code === undefined || code === "0x") return false
  const result = yield* view(client, address, encodeIsModuleInstalled(MODULE_TYPE_VALIDATOR, SmartSession.v1.address))
  return result !== undefined && result !== "0x" && decodeIsModuleInstalled(result)
})

const supported = (
  implementation: Hex
): { readonly type: "kernel" | "nexus"; readonly version: string } | undefined => {
  for (const [version, contracts] of Object.entries(External.kernel)) {
    if (isAddressEqual(contracts.implementation, implementation)) return { type: "kernel", version }
  }
  for (const [version, contracts] of Object.entries(External.nexus)) {
    if (isAddressEqual(contracts.implementation, implementation)) return { type: "nexus", version }
  }
  return undefined
}

/** Reads which supported account, if any, lives at an address. @internal */
export const detect = Effect.fnUntraced(function*(
  client: ReadClient,
  address: Hex
): Effect.fn.Return<Detected, ChainError.ChainError> {
  const code = yield* readCode(client, address)
  if (code === undefined || code === "0x") return { type: "undeployed" }

  const eip7702 = code.startsWith(DELEGATION_PREFIX)
  const implementation = eip7702
    ? (`0x${code.slice(DELEGATION_PREFIX.length, DELEGATION_PREFIX.length + 40)}` as Hex)
    : (yield* readSlot(client, address, IMPLEMENTATION_SLOT)) ?? (yield* readSlot(client, address, SAFE_SINGLETON_SLOT))
  if (implementation === undefined) return { type: "unsupported", implementation: undefined }

  const known = supported(implementation)
  if (known !== undefined) {
    return { ...known, eip7702, implementation, sessionsInstalled: yield* isSessionsInstalled(client, address) }
  }

  // A Safe is a Safe7579 account when the adapter answers its ERC-7579 `accountId`.
  for (const [version, contracts] of Object.entries(External.safe7579)) {
    if (eip7702 || !isAddressEqual(contracts.singletonL2, implementation)) continue
    const accountId = yield* view(client, address, encodeAccountId)
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

/** The options of `from`. */
export interface FromOptions {
  readonly client: AccountClient
  readonly address: Hex
  readonly owner?: Owner | undefined
  readonly owners?: ReadonlyArray<Owner> | undefined
}

/** Builds the Namera account for an existing account, choosing its type from `detect`. @internal */
export const from = Effect.fnUntraced(function*(
  options: FromOptions
): Effect.fn.Return<NameraSmartAccount, AccountError.AccountError | ChainError.ChainError> {
  const ref = { type: "unknown", address: options.address } as const
  const owners = options.owners ?? (options.owner === undefined ? [] : [options.owner])
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
    case "safe7579":
      return yield* Safe7579.from({ client: options.client, owners, address: options.address, sessions: false })
    case "kernel":
    case "nexus": {
      const build = detected.type === "kernel" ? Kernel : Nexus
      const version = detected.version as never
      if (!detected.eip7702) {
        return yield* build.from({ client: options.client, owner, version, address: options.address, sessions: false })
      }
      if (owner.type !== "local" || !isAddressEqual(owner.address, options.address)) {
        return yield* AccountError.invalidOptions({
          account: { type: detected.type, address: options.address },
          detail: "an EIP-7702 account's owner is its own local key"
        })
      }
      return yield* build.fromEip7702({
        client: options.client,
        owner: owner as PrivateKeyAccount,
        version,
        sessions: false
      })
    }
  }
})

/** The calls that install Smart Sessions on a Namera account, for batching with other calls. @internal */
export const installSessionsCalls = (account: NameraSmartAccount): ReadonlyArray<Call> => {
  switch (account.namera.type) {
    case "kernel":
      return [Kernel.installSessionsCall(account.address)]
    case "nexus":
      return [Nexus.installSessionsCall(account.address)]
    case "safe7579":
      return [Safe7579.installSessionsCall(account.address)]
  }
}

/** A viem bundler client; its account must be one Namera built. */
export type BundlerClient = Client<Transport, Chain | undefined, SmartAccount | undefined>

const bundlerAccount = (client: BundlerClient): Effect.Effect<NameraSmartAccount, AccountError.AccountError> =>
  client.account === undefined || !("namera" in client.account)
    ? Effect.fail(
      AccountError.notSupported({ account: { type: "unknown" }, detail: "the bundler client has no Namera account" })
    )
    : Effect.succeed(client.account as NameraSmartAccount)

/** Sends one user operation that installs Smart Sessions, returning its hash. @internal */
export const installSessions = Effect.fnUntraced(function*(
  client: BundlerClient
): Effect.fn.Return<Hex, AccountError.AccountError | ChainError.ChainError> {
  const account = yield* bundlerAccount(client)
  return yield* Effect.tryPromise({
    try: () =>
      getAction(client, sendUserOperation, "sendUserOperation")({
        account,
        calls: [...installSessionsCalls(account)]
      } as never),
    catch: (cause) => fromUnknown(cause, "eth_sendUserOperation")
  })
})

/** Installs Smart Sessions and waits until the operation is included, returning its transaction receipt. @internal */
export const installSessionsSync = Effect.fnUntraced(function*(
  client: BundlerClient
): Effect.fn.Return<TransactionReceipt, AccountError.AccountError | ChainError.ChainError> {
  const hash = yield* installSessions(client)
  const { receipt, success } = yield* Effect.tryPromise({
    try: () => getAction(client, waitForUserOperationReceipt, "waitForUserOperationReceipt")({ hash }),
    catch: (cause) => fromUnknown(cause, "eth_getUserOperationReceipt")
  })
  if (!success) {
    return yield* ChainError.reverted({ method: "eth_sendUserOperation", detail: `user operation ${hash} reverted` })
  }
  return receipt
})
