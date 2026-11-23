import * as External from "@namera-ai/contracts/External"
import * as SmartSession from "@namera-ai/contracts/SmartSession"
import * as Effect from "effect/Effect"

import type * as ChainError from "../../ChainError.ts"
import { encodeCalls, encodeInstallModule, MODULE_TYPE_VALIDATOR } from "../../internal/core/account/erc7579.ts"
import * as Nexus from "../../internal/core/account/nexus.ts"
import {
  type AccountClient,
  call,
  type ChainClient,
  type Hex,
  type Owner,
  type PrivateKeyAccount
} from "../../internal/viem/client.ts"
import {
  getAddress,
  hashMessage,
  hashTypedData,
  ownerSigner,
  type SignableMessage,
  toPrefixedMessage,
  type TypedDataDefinition,
  wrapTypedData
} from "../../internal/viem/signing.ts"
import type * as AccountError from "../AccountError.ts"
import * as Passkeys from "./passkeys.ts"
import { DUMMY_ECDSA_SIGNATURE } from "./signatures.ts"
import { define, type NameraSmartAccount, requireChain } from "./smartAccount.ts"

const zeroHash = "0x0000000000000000000000000000000000000000000000000000000000000000"

/** The Nexus versions Namera supports. */
export type Version = keyof typeof External.nexus

/** The options of `from`. */
export interface FromOptions {
  readonly client: AccountClient
  readonly owner: Owner | Passkeys.Owner
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

// The EIP-712 domain version each implementation reports: Nexus 1.3.3 still reports "1.3.2".
const domainVersions: Record<Version, string> = { "1.3.3": "1.3.2" }

/**
 * The call that installs Smart Sessions on a Nexus account, as a validator.
 *
 * @internal
 */
export const installSessionsCall = (address: Hex) => ({
  to: address,
  data: encodeInstallModule(MODULE_TYPE_VALIDATOR, SmartSession.v1.address, "0x")
})

/** How the owner signs: its validator's nonce lane, the stub, and user operation and ERC-1271 signatures. */
interface Signing {
  readonly nonceKey: bigint
  readonly stubSignature: Hex
  readonly signUserOperationHash: (hash: Hex) => Effect.Effect<Hex, AccountError.AccountError>
  readonly signMessage: (message: SignableMessage) => Effect.Effect<Hex, AccountError.AccountError>
  readonly signTypedData: (typedData: TypedDataDefinition) => Effect.Effect<Hex, AccountError.AccountError>
  readonly passkeys?: Passkeys.Signing | undefined
}

const ecdsaSigning = (
  client: ChainClient,
  owner: Owner,
  version: Version,
  ref: AccountError.Options["account"] & { readonly address: Hex }
): Signing => {
  const signer = ownerSigner(client, owner, ref)

  // ERC-7739: the owner signs Nexus-nested typed data in the account's EIP-712 domain, so JSON-RPC wallets can sign
  // it with `eth_signTypedData_v4`. 20 zero bytes select the default validator.
  const verifierDomain = {
    name: "Nexus",
    version: domainVersions[version],
    chainId: client.chain.id,
    verifyingContract: ref.address,
    salt: zeroHash
  } as const
  const defaultValidator = "0x0000000000000000000000000000000000000000"

  return {
    nonceKey: BigInt("0"),
    stubSignature: DUMMY_ECDSA_SIGNATURE,
    signUserOperationHash: (hash) => signer.signMessage({ raw: hash }),
    signMessage: (message) => {
      const { salt: _, ...domain } = verifierDomain
      return signer.signTypedData({
        domain,
        types: { PersonalSign: [{ name: "prefixed", type: "bytes" }] },
        primaryType: "PersonalSign",
        message: { prefixed: toPrefixedMessage(message) }
      }).pipe(Effect.map((signature) => Nexus.ownerSignature(defaultValidator, signature)))
    },
    // The wrapper's type set holds the caller's types, which are only known at run time.
    signTypedData: (typedData) =>
      signer.signTypedData({
        domain: typedData.domain,
        types: {
          ...typedData.types,
          TypedDataSign: [
            { name: "contents", type: typedData.primaryType },
            { name: "name", type: "string" },
            { name: "version", type: "string" },
            { name: "chainId", type: "uint256" },
            { name: "verifyingContract", type: "address" },
            { name: "salt", type: "bytes32" }
          ]
        },
        primaryType: "TypedDataSign",
        message: { contents: typedData.message, ...verifierDomain }
      } as unknown as TypedDataDefinition).pipe(
        Effect.map((signature) => Nexus.ownerSignature(defaultValidator, wrapTypedData(typedData, signature)))
      )
  }
}

// Passkeys sign through WebAuthnValidator, a validator module the nonce key and the ERC-1271 prefix select; the
// validator binds ERC-1271 hashes to the account and chain.
const passkeySigning = Effect.fnUntraced(function*(
  client: ChainClient,
  owners: Passkeys.Owners,
  ref: AccountError.Options["account"] & { readonly address: Hex }
): Effect.fn.Return<Signing, ChainError.ChainError> {
  const passkeys = yield* Passkeys.signing(client, owners, ref)
  const sign1271 = (hash: Hex) =>
    passkeys.sign1271(hash).pipe(Effect.map((signature) => Nexus.ownerSignature(Passkeys.validator, signature)))
  return {
    passkeys,
    nonceKey: Nexus.validatorNonceKey(Passkeys.validator),
    stubSignature: passkeys.stubSignature,
    signUserOperationHash: passkeys.signUserOperationHash,
    signMessage: (message) => sign1271(hashMessage(message)),
    signTypedData: (typedData) => sign1271(hashTypedData(typedData))
  }
})

const build = Effect.fnUntraced(function*(options: {
  readonly client: AccountClient
  readonly signing: (
    client: ChainClient,
    ref: AccountError.Options["account"] & { readonly address: Hex }
  ) => Effect.Effect<Signing, ChainError.ChainError>
  readonly version: Version
  readonly address: Hex
  readonly eip7702: boolean
  readonly factory?: { readonly address: Hex; readonly data: Hex } | undefined
  readonly authorization?: { readonly account: PrivateKeyAccount; readonly address: Hex } | undefined
  readonly firstCalls?: ReadonlyArray<{ readonly to: Hex; readonly data: Hex }> | undefined
}) {
  const ref = { type: "nexus", address: options.address } as const
  const client = yield* requireChain(options.client, ref)
  const signing = yield* options.signing(client, ref)

  const account = yield* define({
    metadata: { type: "nexus", version: options.version, entryPoint: "0.7", eip7702: options.eip7702 },
    client,
    address: options.address,
    factory: options.factory,
    authorization: options.authorization,
    firstCalls: options.firstCalls,
    nonceKey: signing.nonceKey,
    stubSignature: signing.stubSignature,
    encodeCalls,
    signUserOperationHash: signing.signUserOperationHash,
    signMessage: signing.signMessage,
    signTypedData: signing.signTypedData
  })
  return signing.passkeys === undefined ? account : Passkeys.register(account, signing.passkeys)
})

/** @internal */
export const from = Effect.fnUntraced(function*(
  options: FromOptions
): Effect.fn.Return<NameraSmartAccount<"nexus">, AccountError.AccountError | ChainError.ChainError> {
  const version = options.version ?? "1.3.3"
  const contracts = External.nexus[version]
  const passkeys = Passkeys.isOwner(options.owner)
    ? yield* Passkeys.fromOwner(options.owner, { type: "nexus" })
    : undefined
  const owner = options.owner as Owner
  const { addressCall, factoryData } = Nexus.deployment({
    contracts,
    owner: passkeys === undefined
      ? { type: "default", address: owner.address }
      : { type: "module", validator: Passkeys.validator, data: Passkeys.installData(passkeys) },
    smartSession: options.sessions === false ? undefined : SmartSession.v1.address,
    index: options.index ?? BigInt("0")
  })
  const address = options.address ??
    Nexus.decodeAddress((yield* call(options.client, { to: contracts.factory, data: addressCall })) ?? "0x")
  return yield* build({
    client: options.client,
    signing: (client, ref) =>
      passkeys === undefined
        ? Effect.succeed(ecdsaSigning(client, owner, version, ref))
        : passkeySigning(client, passkeys, ref),
    version,
    address: getAddress(address),
    eip7702: false,
    factory: { address: contracts.factory, data: factoryData }
  })
})

/** @internal */
export const fromEip7702 = (
  options: FromEip7702Options
): Effect.Effect<NameraSmartAccount<"nexus">, AccountError.AccountError | ChainError.ChainError> => {
  const version = options.version ?? "1.3.3"
  return build({
    client: options.client,
    signing: (client, ref) => Effect.succeed(ecdsaSigning(client, options.owner, version, ref)),
    version,
    address: options.owner.address,
    eip7702: true,
    authorization: { account: options.owner, address: External.nexus[version].implementation },
    firstCalls: options.sessions === false ? undefined : [installSessionsCall(options.owner.address)]
  })
}
