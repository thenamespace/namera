import * as External from "@namera-ai/contracts/External"
import * as SmartSession from "@namera-ai/contracts/SmartSession"
import * as Effect from "effect/Effect"
import {
  getAddress,
  type Hex,
  type PrivateKeyAccount,
  toPrefixedMessage,
  type TypedDataDefinition,
  zeroHash
} from "viem"
import { call } from "viem/actions"
import { wrapTypedDataSignature } from "viem/experimental/erc7739"

import type * as ChainError from "../../ChainError.ts"
import { fromUnknown } from "../../internal/chainError.ts"
import { encodeCalls, encodeInstallModule, MODULE_TYPE_VALIDATOR } from "../../internal/core/account/erc7579.ts"
import * as Nexus from "../../internal/core/account/nexus.ts"
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

/** The Nexus versions Namera supports. */
export type Version = keyof typeof External.nexus

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
  const ref = { type: "nexus", address: options.address } as const
  const client = yield* requireChain(options.client, ref)
  const signer = ownerSigner(client, options.owner, ref)

  // ERC-7739: the owner signs Nexus-nested typed data in the account's EIP-712 domain, so JSON-RPC wallets can sign
  // it with `eth_signTypedData_v4`. 20 zero bytes select the default validator.
  const verifierDomain = {
    name: "Nexus",
    version: domainVersions[options.version],
    chainId: client.chain.id,
    verifyingContract: options.address,
    salt: zeroHash
  } as const

  // The wrapper's type set holds the caller's types, which are only known at run time.
  const signTypedData = (typedData: TypedDataDefinition) =>
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
      Effect.map((signature) =>
        Nexus.ownerSignature(
          wrapTypedDataSignature({ ...typedData, signature } as Parameters<typeof wrapTypedDataSignature>[0])
        )
      )
    )

  return yield* make({
    metadata: { type: "nexus", version: options.version, entryPoint: "0.7", eip7702: options.eip7702 },
    client,
    address: options.address,
    factory: options.factory,
    authorization: options.authorization,
    firstCalls: options.firstCalls,
    nonceKey: BigInt("0"),
    stubSignature: DUMMY_ECDSA_SIGNATURE,
    encodeCalls,
    signUserOperationHash: (hash) => signer.signMessage({ raw: hash }),
    signMessage: (message) => {
      const { salt: _, ...domain } = verifierDomain
      return signer.signTypedData({
        domain,
        types: { PersonalSign: [{ name: "prefixed", type: "bytes" }] },
        primaryType: "PersonalSign",
        message: { prefixed: toPrefixedMessage(message) }
      }).pipe(Effect.map(Nexus.ownerSignature))
    },
    signTypedData
  })
})

/** @internal */
export const from = Effect.fnUntraced(function*(
  options: FromOptions
): Effect.fn.Return<NameraSmartAccount<"nexus">, AccountError.AccountError | ChainError.ChainError> {
  const version = options.version ?? "1.3.3"
  const contracts = External.nexus[version]
  const { addressCall, factoryData } = Nexus.deployment({
    contracts,
    owner: options.owner.address,
    smartSession: options.sessions === false ? undefined : SmartSession.v1.address,
    index: options.index ?? BigInt("0")
  })
  const address = options.address ?? Nexus.decodeAddress(
    (yield* Effect.tryPromise({
      try: () => call(options.client, { to: contracts.factory, data: addressCall }),
      catch: (cause) => fromUnknown(cause, "eth_call")
    })).data ?? "0x"
  )
  return yield* build({
    client: options.client,
    owner: options.owner,
    version,
    address: getAddress(address),
    eip7702: false,
    factory: { address: contracts.factory, data: factoryData }
  })
})

/** @internal */
export const fromEip7702 = (
  options: FromEip7702Options
): Effect.Effect<NameraSmartAccount<"nexus">, AccountError.AccountError> => {
  const version = options.version ?? "1.3.3"
  return build({
    client: options.client,
    owner: options.owner,
    version,
    address: options.owner.address,
    eip7702: true,
    authorization: { account: options.owner, address: External.nexus[version].implementation },
    firstCalls: options.sessions === false ? undefined : [installSessionsCall(options.owner.address)]
  })
}
