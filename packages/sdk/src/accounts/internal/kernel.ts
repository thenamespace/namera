import * as External from "@namera-ai/contracts/External"
import * as SmartSession from "@namera-ai/contracts/SmartSession"
import * as Effect from "effect/Effect"
import { hashMessage, hashTypedData, type Hex, type PrivateKeyAccount } from "viem"

import { encodeCalls, encodeInstallModule, MODULE_TYPE_VALIDATOR } from "../../internal/core/account/erc7579.ts"
import * as Kernel from "../../internal/core/account/kernel.ts"
import type * as AccountError from "../AccountError.ts"
import { DUMMY_ECDSA_SIGNATURE } from "./signatures.ts"
import {
  type AccountClient,
  make,
  type NameraSmartAccount,
  type Owner,
  ownerSigner,
  requireChain
} from "./smartAccount.ts"

/** The Kernel versions Namera supports. */
export type Version = keyof typeof External.kernel

/** The options of `from`. */
export interface FromOptions {
  readonly client: AccountClient
  readonly owner: Owner
  readonly version?: Version | undefined
  readonly index?: bigint | undefined
  readonly address?: Hex | undefined
  readonly sessions?: boolean | undefined
}

/** The options of `fromEip7702`. */
export interface FromEip7702Options {
  readonly client: AccountClient
  readonly owner: PrivateKeyAccount
  readonly version?: Version | undefined
  readonly sessions?: boolean | undefined
}

/**
 * The call that installs Smart Sessions on a Kernel account, as a validator for `execute`.
 *
 * @internal
 */
export const installSessionsCall = (address: Hex) => ({
  to: address,
  data: encodeInstallModule(MODULE_TYPE_VALIDATOR, SmartSession.v1.address, Kernel.validatorInstallData("0x"))
})

const build = Effect.fnUntraced(function*(options: {
  readonly client: AccountClient
  readonly owner: Owner
  readonly version: Version
  readonly address: Hex
  readonly eip7702: boolean
  readonly factory?: { readonly address: Hex; readonly data: Hex } | undefined
  readonly authorization?: { readonly account: PrivateKeyAccount; readonly address: Hex } | undefined
  readonly firstCalls?: ReadonlyArray<{ readonly to: Hex; readonly data: Hex }> | undefined
}) {
  const ref = { type: "kernel", address: options.address } as const
  const client = yield* requireChain(options.client, ref)
  const contracts = External.kernel[options.version]
  const signer = ownerSigner(client, options.owner, ref)

  // ERC-1271: the owner signs the hash wrapped as `Kernel(bytes32 hash)` in the account's domain. An EIP-7702 account
  // checks the raw EIP-712 digest against its own address, so it signs the typed data; a deployed account's ECDSA
  // validator accepts the personal-sign form of the digest.
  // Kernel's EIP-712 domain names its version with the leading `0.` (`"0.3.3"`).
  const domainVersion = `0.${options.version}`
  const sign1271 = (hash: Hex) =>
    (options.eip7702
      ? signer.signTypedData({
        domain: {
          name: "Kernel",
          version: domainVersion,
          chainId: client.chain.id,
          verifyingContract: options.address
        },
        types: { Kernel: [{ name: "hash", type: "bytes32" }] },
        primaryType: "Kernel",
        message: { hash }
      })
      : signer.signMessage({
        raw: Kernel.wrappedHash({ hash, account: options.address, chainId: client.chain.id, version: domainVersion })
      })).pipe(Effect.map((signature) => Kernel.ownerSignature(contracts, signature, options.eip7702)))

  return yield* make({
    metadata: { type: "kernel", version: options.version, entryPoint: "0.7", eip7702: options.eip7702 },
    client,
    address: options.address,
    factory: options.factory,
    authorization: options.authorization,
    firstCalls: options.firstCalls,
    nonceKey: Kernel.ownerNonceKey(contracts),
    stubSignature: DUMMY_ECDSA_SIGNATURE,
    encodeCalls,
    signUserOperationHash: (hash) => signer.signMessage({ raw: hash }),
    signMessage: (message) => sign1271(hashMessage(message)),
    signTypedData: (typedData) => sign1271(hashTypedData(typedData))
  })
})

/** @internal */
export const from = (options: FromOptions): Effect.Effect<NameraSmartAccount<"kernel">, AccountError.AccountError> => {
  const version = options.version ?? "3.3"
  const contracts = External.kernel[version]
  const initData = Kernel.initData({
    contracts,
    owner: options.owner.address,
    smartSession: options.sessions === false ? undefined : SmartSession.v1.address
  })
  const { address, factory, factoryData } = Kernel.deployment({
    contracts,
    initData,
    index: options.index ?? BigInt("0")
  })
  return build({
    client: options.client,
    owner: options.owner,
    version,
    address: options.address ?? address,
    eip7702: false,
    factory: { address: factory, data: factoryData }
  })
}

/** @internal */
export const fromEip7702 = (
  options: FromEip7702Options
): Effect.Effect<NameraSmartAccount<"kernel">, AccountError.AccountError> => {
  const version = options.version ?? "3.3"
  return build({
    client: options.client,
    owner: options.owner,
    version,
    address: options.owner.address,
    eip7702: true,
    authorization: { account: options.owner, address: External.kernel[version].implementation },
    firstCalls: options.sessions === false ? undefined : [installSessionsCall(options.owner.address)]
  })
}
