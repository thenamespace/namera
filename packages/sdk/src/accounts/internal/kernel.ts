import * as External from "@namera-ai/contracts/External"
import * as SmartSession from "@namera-ai/contracts/SmartSession"
import * as Effect from "effect/Effect"

import type * as ChainError from "../../ChainError.ts"
import { encodeCalls, encodeInstallModule, MODULE_TYPE_VALIDATOR } from "../../internal/core/account/erc7579.ts"
import * as Kernel from "../../internal/core/account/kernel.ts"
import * as WebAuthn from "../../internal/core/account/webauthn.ts"
import {
  type AccountClient,
  type ChainClient,
  hasP256Precompile,
  type Hex,
  type Owner,
  type PrivateKeyAccount
} from "../../internal/viem/client.ts"
import {
  hashMessage,
  hashTypedData,
  isWebAuthnAccount,
  ownerSigner,
  passkeySigner,
  type WebAuthnAccount
} from "../../internal/viem/signing.ts"
import * as AccountError from "../AccountError.ts"
import { DUMMY_ECDSA_SIGNATURE } from "./signatures.ts"
import { define, type NameraSmartAccount, requireChain } from "./smartAccount.ts"

/** The Kernel versions Namera supports. */
export type Version = keyof typeof External.kernel

/** The options of `from`. */
export interface FromOptions {
  readonly client: AccountClient
  readonly owner: Owner | WebAuthnAccount
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

/**
 * How the owner signs: its root validator, what it signs a user operation hash and an ERC-1271 digest with, and the
 * stub signature for gas estimation.
 */
interface Signing {
  readonly rootValidator: Hex
  readonly stubSignature: Hex
  readonly signUserOperationHash: (hash: Hex) => Effect.Effect<Hex, AccountError.AccountError>
  readonly sign1271: (
    hash: Hex,
    context: { readonly client: ChainClient; readonly address: Hex; readonly domainVersion: string }
  ) => Effect.Effect<Hex, AccountError.AccountError>
}

const ecdsaSigning = (
  client: ChainClient,
  owner: Owner,
  contracts: Kernel.Contracts,
  ref: AccountError.Options["account"],
  eip7702: boolean
): Signing => {
  const signer = ownerSigner(client, owner, ref)
  return {
    rootValidator: contracts.ecdsaValidator,
    stubSignature: DUMMY_ECDSA_SIGNATURE,
    signUserOperationHash: (hash) => signer.signMessage({ raw: hash }),
    // An EIP-7702 account checks the raw EIP-712 digest against its own address, so it signs the typed data; a deployed
    // account's ECDSA validator accepts the personal-sign form of the digest.
    sign1271: (hash, { address, client, domainVersion }) =>
      eip7702
        ? signer.signTypedData({
          domain: { name: "Kernel", version: domainVersion, chainId: client.chain.id, verifyingContract: address },
          types: { Kernel: [{ name: "hash", type: "bytes32" }] },
          primaryType: "Kernel",
          message: { hash }
        })
        : signer.signMessage({
          raw: Kernel.wrappedHash({ hash, account: address, chainId: client.chain.id, version: domainVersion })
        })
  }
}

// A passkey signs the hash itself as its WebAuthn challenge: the user operation hash, or the ERC-1271 digest wrapped in
// Kernel's domain. The precompile flag follows the chain, so verification costs P-256 precompile gas where it exists.
const passkeySigning = Effect.fnUntraced(function*(
  client: ChainClient,
  owner: WebAuthnAccount,
  contracts: Kernel.Contracts,
  ref: AccountError.Options["account"]
): Effect.fn.Return<Signing, ChainError.ChainError> {
  const usePrecompile = yield* hasP256Precompile(client)
  const signer = passkeySigner(owner, ref, usePrecompile)
  return {
    rootValidator: contracts.webAuthnValidator,
    stubSignature: WebAuthn.stubSignature(usePrecompile),
    signUserOperationHash: signer.sign,
    sign1271: (hash, { address, client, domainVersion }) =>
      signer.sign(Kernel.wrappedHash({ hash, account: address, chainId: client.chain.id, version: domainVersion }))
  }
})

const build = Effect.fnUntraced(function*(options: {
  readonly client: AccountClient
  readonly signing: (client: ChainClient, ref: AccountError.Options["account"]) => Effect.Effect<
    Signing,
    ChainError.ChainError
  >
  readonly version: Version
  readonly address: Hex
  readonly eip7702: boolean
  readonly factory?: { readonly address: Hex; readonly data: Hex } | undefined
  readonly authorization?: { readonly account: PrivateKeyAccount; readonly address: Hex } | undefined
  readonly firstCalls?: ReadonlyArray<{ readonly to: Hex; readonly data: Hex }> | undefined
}) {
  const ref = { type: "kernel", address: options.address } as const
  const client = yield* requireChain(options.client, ref)
  const signing = yield* options.signing(client, ref)
  // Kernel's EIP-712 domain names its version with the leading `0.` (`"0.3.3"`).
  const domainVersion = `0.${options.version}`
  const sign1271 = (hash: Hex) =>
    signing.sign1271(hash, { client, address: options.address, domainVersion }).pipe(
      Effect.map((signature) => Kernel.ownerSignature(signing.rootValidator, signature, options.eip7702))
    )

  return yield* define({
    metadata: { type: "kernel", version: options.version, entryPoint: "0.7", eip7702: options.eip7702 },
    client,
    address: options.address,
    factory: options.factory,
    authorization: options.authorization,
    firstCalls: options.firstCalls,
    nonceKey: Kernel.ownerNonceKey(signing.rootValidator),
    stubSignature: signing.stubSignature,
    encodeCalls,
    signUserOperationHash: signing.signUserOperationHash,
    signMessage: (message) => sign1271(hashMessage(message)),
    signTypedData: (typedData) => sign1271(hashTypedData(typedData))
  })
})

/** @internal */
export const from = Effect.fnUntraced(function*(
  options: FromOptions
): Effect.fn.Return<NameraSmartAccount<"kernel">, AccountError.AccountError | ChainError.ChainError> {
  const version = options.version ?? "3.3"
  const contracts = External.kernel[version]
  const { owner } = options
  const passkey = isWebAuthnAccount(owner)
  const initData = Kernel.initData({
    rootValidator: passkey ? contracts.webAuthnValidator : contracts.ecdsaValidator,
    validatorData: passkey
      ? WebAuthn.validatorData({ publicKey: owner.publicKey, id: owner.id })
      : owner.address,
    smartSession: options.sessions === false ? undefined : SmartSession.v1.address
  })
  const { address, factory, factoryData } = Kernel.deployment({
    contracts,
    initData,
    index: options.index ?? BigInt("0")
  })
  return yield* build({
    client: options.client,
    signing: (client, ref) =>
      passkey
        ? passkeySigning(client, owner, contracts, ref)
        : Effect.succeed(ecdsaSigning(client, owner, contracts, ref, false)),
    version,
    address: options.address ?? address,
    eip7702: false,
    factory: { address: factory, data: factoryData }
  })
})

/** @internal */
export const fromEip7702 = (
  options: FromEip7702Options
): Effect.Effect<NameraSmartAccount<"kernel">, AccountError.AccountError | ChainError.ChainError> => {
  const version = options.version ?? "3.3"
  const contracts = External.kernel[version]
  if (isWebAuthnAccount(options.owner as Owner | WebAuthnAccount)) {
    return Effect.fail(
      AccountError.invalidOptions({
        account: { type: "kernel" },
        detail: "an EIP-7702 account's owner is its own local key, not a passkey"
      })
    )
  }
  return build({
    client: options.client,
    signing: (client, ref) => Effect.succeed(ecdsaSigning(client, options.owner, contracts, ref, true)),
    version,
    address: options.owner.address,
    eip7702: true,
    authorization: { account: options.owner, address: contracts.implementation },
    firstCalls: options.sessions === false ? undefined : [installSessionsCall(options.owner.address)]
  })
}
