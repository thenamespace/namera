import * as AbiParameters from "ox/AbiParameters"
import * as Address from "ox/Address"

/**
 * A session key as `ECDSASessionValidator` checks it: `threshold` of the `signers` sign, signers in ascending order.
 */
export interface EcdsaSessionKey {
  readonly type: "ecdsa"
  readonly threshold: number
  readonly signers: ReadonlyArray<Address.Address>
}

/**
 * Why a session key is invalid.
 *
 * @internal
 */
export type Problem =
  | { readonly _tag: "InvalidAddress"; readonly value: string }
  | { readonly _tag: "NoSigners" }
  | { readonly _tag: "DuplicateSigner"; readonly signer: Address.Address }
  | { readonly _tag: "InvalidThreshold"; readonly threshold: number; readonly signers: number }

/**
 * Validates and normalises a k-of-n ECDSA session key: checksummed addresses, sorted ascending, no duplicates, and a
 * whole threshold from 1 to the number of signers.
 *
 * @internal
 */
export const ecdsa = (
  threshold: number,
  signers: ReadonlyArray<string>
): { readonly sessionKey: EcdsaSessionKey } | { readonly problem: Problem } => {
  if (signers.length === 0) return { problem: { _tag: "NoSigners" } }

  const checksummed: Array<Address.Address> = []
  for (const value of signers) {
    if (!Address.validate(value)) return { problem: { _tag: "InvalidAddress", value } }
    const signer = Address.checksum(value)
    if (checksummed.includes(signer)) return { problem: { _tag: "DuplicateSigner", signer } }
    checksummed.push(signer)
  }

  if (!Number.isInteger(threshold) || threshold < 1 || threshold > checksummed.length) {
    return { problem: { _tag: "InvalidThreshold", threshold, signers: checksummed.length } }
  }

  const sorted = [...checksummed].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1))
  return { sessionKey: { type: "ecdsa", threshold, signers: sorted } }
}

const configParameters = AbiParameters.from(["uint256 threshold", "address[] signers"])

/**
 * The config `ECDSASessionValidator` reads: `abi.encode(uint256 threshold, address[] signers)`.
 */
export const encodeConfig = (sessionKey: EcdsaSessionKey): `0x${string}` =>
  AbiParameters.encode(configParameters, [BigInt(sessionKey.threshold), sessionKey.signers])
