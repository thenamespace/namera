import * as External from "@namera-ai/contracts/External"
import * as SmartSession from "@namera-ai/contracts/SmartSession"
import * as Effect from "effect/Effect"
import type { Hex } from "viem"

import { encodeCalls, encodeInstallModule, MODULE_TYPE_VALIDATOR } from "../../internal/core/account/erc7579.ts"
import * as Safe7579 from "../../internal/core/account/safe7579.ts"
import * as AccountError from "../AccountError.ts"
import { DUMMY_ECDSA_SIGNATURE } from "./signatures.ts"
import {
  type AccountClient,
  make,
  type NameraSmartAccount,
  type Owner,
  ownerSigner,
  requireChain
} from "./smartAccount.ts"

/** The Safe7579 versions Namera supports. */
export type Version = `${keyof typeof External.safe7579}`

/** The options of `from`. */
export interface FromOptions {
  readonly client: AccountClient
  readonly owners: ReadonlyArray<Owner>
  readonly threshold?: number | undefined
  readonly version?: Version | undefined
  readonly index?: bigint | undefined
  readonly address?: Hex | undefined
  readonly sessions?: boolean | undefined
}

/**
 * The call that installs Smart Sessions on a Safe7579 account, as a validator.
 *
 * @internal
 */
export const installSessionsCall = (address: Hex) => ({
  to: address,
  data: encodeInstallModule(MODULE_TYPE_VALIDATOR, SmartSession.v1.address, "0x")
})

/** @internal */
export const from = Effect.fnUntraced(function*(
  options: FromOptions
): Effect.fn.Return<NameraSmartAccount<"safe7579">, AccountError.AccountError> {
  const version = options.version ?? "2"
  const contracts = External.safe7579[version]
  const threshold = options.threshold ?? options.owners.length
  const owners = Safe7579.sortOwners(options.owners.map((owner) => owner.address))

  if (owners.length === 0 || new Set(owners.map((owner) => owner.toLowerCase())).size !== owners.length) {
    return yield* AccountError.invalidOptions({
      account: { type: "safe7579" },
      detail: "owners must be distinct and non-empty"
    })
  }
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > owners.length) {
    return yield* AccountError.invalidOptions({
      account: { type: "safe7579" },
      detail: `threshold ${threshold} with ${owners.length} owners`
    })
  }

  const initializer = Safe7579.initializer({
    contracts,
    owners,
    threshold: BigInt(threshold),
    smartSession: options.sessions === false ? undefined : SmartSession.v1.address
  })
  const deployment = Safe7579.deployment({ contracts, initializer, index: options.index ?? 0n })
  const address = options.address ?? deployment.address
  const ref = { type: "safe7579", address } as const
  const client = yield* requireChain(options.client, ref)

  // OwnableValidator needs `threshold` signatures; the first owners in address order sign, and it ignores the order.
  const signers = [...options.owners]
    .sort((a, b) => (BigInt(a.address) < BigInt(b.address) ? -1 : 1))
    .slice(0, threshold)
    .map((owner) => ownerSigner(client, owner, ref))
  const signAll = (sign: (signer: (typeof signers)[number]) => Effect.Effect<Hex, AccountError.AccountError>) =>
    Effect.forEach(signers, sign)

  return yield* make({
    metadata: { type: "safe7579", version, entryPoint: "0.7", eip7702: false },
    client,
    address,
    factory: { address: contracts.proxyFactory, data: deployment.factoryData },
    nonceKey: Safe7579.ownerNonceKey(contracts),
    stubSignature: Safe7579.concatSignatures(Array.from({ length: threshold }, () => DUMMY_ECDSA_SIGNATURE)),
    encodeCalls,
    signUserOperationHash: (hash) =>
      signAll((signer) => signer.signMessage({ raw: hash })).pipe(Effect.map(Safe7579.concatSignatures)),
    // ERC-1271: OwnableValidator checks the signatures over the raw hash, which is what signing the message or typed
    // data itself produces.
    signMessage: (message) =>
      signAll((signer) => signer.signMessage(message)).pipe(
        Effect.map((signatures) => Safe7579.ownerSignature(contracts, signatures))
      ),
    signTypedData: (typedData) =>
      signAll((signer) => signer.signTypedData(typedData)).pipe(
        Effect.map((signatures) => Safe7579.ownerSignature(contracts, signatures))
      )
  })
})
