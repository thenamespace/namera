import * as External from "@namera-ai/contracts/External"
import * as Effect from "effect/Effect"

import type * as ChainError from "../../ChainError.ts"
import {
  encodeCalls,
  encodeInstallModule,
  MODULE_TYPE_HOOK,
  MODULE_TYPE_VALIDATOR
} from "../../internal/core/account/erc7579.ts"
import * as Safe7579 from "../../internal/core/account/safe7579.ts"
import * as SessionHook from "../../internal/core/account/sessionHook.ts"
import type { AccountClient, ChainClient, Hex, Owner } from "../../internal/viem/client.ts"
import {
  hashMessage,
  hashTypedData,
  isWebAuthnAccount,
  ownerSigner,
  type SignableMessage,
  type TypedDataDefinition,
  type WebAuthnAccount
} from "../../internal/viem/signing.ts"
import * as AccountError from "../AccountError.ts"
import * as Passkeys from "./passkeys.ts"
import { sessionModules } from "./sessionModules.ts"
import { DUMMY_ECDSA_SIGNATURE } from "./signatures.ts"
import { define, type NameraSmartAccount, requireChain } from "./smartAccount.ts"

/** The Safe7579 versions Namera supports. */
export type Version = `${keyof typeof External.safe7579}`

/** The options of `from`. */
export interface FromOptions {
  readonly client: AccountClient
  readonly owners: ReadonlyArray<Owner> | ReadonlyArray<WebAuthnAccount>
  readonly threshold?: number | undefined
  readonly version?: Version | undefined
  readonly index?: bigint | undefined
  readonly address?: Hex | undefined
  readonly sessions?: boolean | undefined
}

/**
 * The calls that install Smart Sessions on a Safe7579 account, as a validator, with SessionHook as the account's hook.
 *
 * @internal
 */
export const installSessionsCalls = (address: Hex): ReadonlyArray<{ readonly to: Hex; readonly data: Hex }> => [
  { to: address, data: encodeInstallModule(MODULE_TYPE_VALIDATOR, sessionModules.smartSession, "0x") },
  {
    to: address,
    data: encodeInstallModule(
      MODULE_TYPE_HOOK,
      sessionModules.sessionHook,
      SessionHook.installData("safe7579", sessionModules.smartSession)
    )
  }
]

/** How the owners sign: their validator, the stub, and user operation and ERC-1271 signatures. */
interface Signing {
  readonly validator: Hex
  readonly stubSignature: Hex
  readonly signUserOperationHash: (hash: Hex) => Effect.Effect<Hex, AccountError.AccountError>
  readonly signMessage: (message: SignableMessage) => Effect.Effect<Hex, AccountError.AccountError>
  readonly signTypedData: (typedData: TypedDataDefinition) => Effect.Effect<Hex, AccountError.AccountError>
  readonly passkeys?: Passkeys.Signing | undefined
}

// OwnableValidator needs `threshold` signatures; the first owners in address order sign, and it ignores the order.
const ownableSigning = (
  client: ChainClient,
  owners: ReadonlyArray<Owner>,
  threshold: number,
  contracts: Safe7579.Contracts,
  ref: AccountError.Options["account"]
): Signing => {
  const signers = [...owners]
    .sort((a, b) => (BigInt(a.address) < BigInt(b.address) ? -1 : 1))
    .slice(0, threshold)
    .map((owner) => ownerSigner(client, owner, ref))
  const signAll = (sign: (signer: (typeof signers)[number]) => Effect.Effect<Hex, AccountError.AccountError>) =>
    Effect.forEach(signers, sign)
  const erc1271 = (signatures: ReadonlyArray<Hex>) =>
    Safe7579.ownerSignature(contracts.ownableValidator, Safe7579.concatSignatures(signatures))

  return {
    validator: contracts.ownableValidator,
    stubSignature: Safe7579.concatSignatures(Array.from({ length: threshold }, () => DUMMY_ECDSA_SIGNATURE)),
    signUserOperationHash: (hash) =>
      signAll((signer) => signer.signMessage({ raw: hash })).pipe(Effect.map(Safe7579.concatSignatures)),
    // ERC-1271: OwnableValidator checks the signatures over the raw hash, which is what signing the message or typed
    // data itself produces.
    signMessage: (message) => signAll((signer) => signer.signMessage(message)).pipe(Effect.map(erc1271)),
    signTypedData: (typedData) => signAll((signer) => signer.signTypedData(typedData)).pipe(Effect.map(erc1271))
  }
}

// Passkeys sign through WebAuthnValidator, which binds ERC-1271 hashes to the account and chain.
const passkeySigning = Effect.fnUntraced(function*(
  client: ChainClient,
  owners: Passkeys.Owners,
  ref: AccountError.Options["account"] & { readonly address: Hex }
): Effect.fn.Return<Signing, ChainError.ChainError> {
  const passkeys = yield* Passkeys.signing(client, owners, ref)
  const sign1271 = (hash: Hex) =>
    passkeys.sign1271(hash).pipe(Effect.map((signature) => Safe7579.ownerSignature(Passkeys.validator, signature)))
  return {
    passkeys,
    validator: Passkeys.validator,
    stubSignature: passkeys.stubSignature,
    signUserOperationHash: passkeys.signUserOperationHash,
    signMessage: (message) => sign1271(hashMessage(message)),
    signTypedData: (typedData) => sign1271(hashTypedData(typedData))
  }
})

const isPasskeys = (owners: FromOptions["owners"]): owners is ReadonlyArray<WebAuthnAccount> =>
  owners.length > 0 && owners.every((owner) => isWebAuthnAccount(owner))

const ownable = (
  owners: ReadonlyArray<Owner | WebAuthnAccount>,
  threshold: number
): Effect.Effect<{ readonly owners: ReadonlyArray<Owner>; readonly threshold: number }, AccountError.AccountError> => {
  const addresses = (owners as ReadonlyArray<Owner>).map((owner) => owner.address?.toLowerCase())
  if (
    owners.length === 0 || owners.some((owner) => isWebAuthnAccount(owner)) || new Set(addresses).size !== owners.length
  ) {
    return Effect.fail(AccountError.invalidOptions({
      account: { type: "safe7579" },
      detail: "owners must be distinct and non-empty, and all keys or all passkeys"
    }))
  }
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > owners.length) {
    return Effect.fail(AccountError.invalidOptions({
      account: { type: "safe7579" },
      detail: `threshold ${threshold} with ${owners.length} owners`
    }))
  }
  return Effect.succeed({ owners: owners as ReadonlyArray<Owner>, threshold })
}

/** @internal */
export const from = Effect.fnUntraced(function*(
  options: FromOptions
): Effect.fn.Return<NameraSmartAccount<"safe7579">, AccountError.AccountError | ChainError.ChainError> {
  const version = options.version ?? "2"
  const contracts = External.safe7579[version]
  const passkeys = isPasskeys(options.owners)
    ? yield* Passkeys.owners(options.owners, options.threshold, { type: "safe7579" })
    : undefined
  const keys = passkeys === undefined
    ? yield* ownable(options.owners, options.threshold ?? options.owners.length)
    : undefined

  const initializer = Safe7579.initializer({
    contracts,
    owner: keys === undefined
      ? { type: "module", validator: Passkeys.validator, data: Passkeys.installData(passkeys!) }
      : {
        type: "ownable",
        owners: keys.owners.map((owner) => owner.address),
        threshold: BigInt(keys.threshold)
      },
    sessions: options.sessions === false ? undefined : sessionModules
  })
  const deployment = Safe7579.deployment({ contracts, initializer, index: options.index ?? BigInt("0") })
  const address = options.address ?? deployment.address
  const ref = { type: "safe7579", address } as const
  const client = yield* requireChain(options.client, ref)
  const signing = keys === undefined
    ? yield* passkeySigning(client, passkeys!, ref)
    : ownableSigning(client, keys.owners, keys.threshold, contracts, ref)

  const account = yield* define({
    metadata: { type: "safe7579", version, entryPoint: "0.7", eip7702: false },
    client,
    address,
    factory: { address: contracts.proxyFactory, data: deployment.factoryData },
    nonceKey: Safe7579.validatorNonceKey(signing.validator),
    stubSignature: signing.stubSignature,
    encodeCalls,
    signUserOperationHash: signing.signUserOperationHash,
    signMessage: signing.signMessage,
    signTypedData: signing.signTypedData
  })
  return signing.passkeys === undefined ? account : Passkeys.register(account, signing.passkeys)
})
