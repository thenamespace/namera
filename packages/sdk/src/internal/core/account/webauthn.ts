import * as AbiParameters from "ox/AbiParameters"
import * as Base64 from "ox/Base64"
import * as Hash from "ox/Hash"
import * as Hex from "ox/Hex"
import * as PublicKey from "ox/PublicKey"

const validatorDataParameters = AbiParameters.from([
  "(uint256 x, uint256 y) webAuthnData",
  "bytes32 authenticatorIdHash"
])

/**
 * What ZeroDev's WebAuthn validator is initialised with for a passkey: its public key `(x, y)` and the keccak256 of
 * its credential id (base64url).
 *
 * @internal
 */
export const validatorData = (options: { readonly publicKey: Hex.Hex; readonly id: string }): Hex.Hex => {
  const { x, y } = PublicKey.fromHex(options.publicKey)
  return AbiParameters.encode(validatorDataParameters, [
    { x: Hex.toBigInt(x), y: Hex.toBigInt(y) },
    // Stryker disable next-line StringLiteral: hex is ox's default output
    Hash.keccak256(Base64.toBytes(options.id), { as: "Hex" })
  ])
}

const signatureParameters = AbiParameters.from([
  "bytes authenticatorData",
  "string clientDataJSON",
  "uint256 responseTypeLocation",
  "uint256 r",
  "uint256 s",
  "bool usePrecompiled"
])

/**
 * A WebAuthn assertion as the validator reads it. With `usePrecompile` it verifies P-256 through the RIP-7212 / EIP-7951
 * precompile; otherwise in Solidity, at far higher gas.
 *
 * @internal
 */
export const encodeSignature = (options: {
  readonly authenticatorData: Hex.Hex
  readonly clientDataJSON: string
  readonly typeIndex: number
  readonly r: bigint
  readonly s: bigint
  readonly usePrecompile: boolean
}): Hex.Hex =>
  AbiParameters.encode(signatureParameters, [
    options.authenticatorData,
    options.clientDataJSON,
    BigInt(options.typeIndex),
    options.r,
    options.s,
    options.usePrecompile
  ])

/**
 * A WebAuthn signature of the right shape for gas estimation (permissionless's), with the precompile flag the real
 * signature will carry.
 *
 * @internal
 */
export const stubSignature = (usePrecompile: boolean): Hex.Hex =>
  encodeSignature({
    authenticatorData: "0x49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97631d00000000",
    clientDataJSON:
      "{\"type\":\"webauthn.get\",\"challenge\":\"tbxXNFS9X_4Byr1cMwqKrIGB-_30a0QhZ6y7ucM0BOE\",\"origin\":\"http://localhost:3000\",\"crossOrigin\":false, \"other_keys_can_be_added_here\":\"do not compare clientDataJSON against a template. See https://goo.gl/yabPex\"}",
    typeIndex: 1,
    r: BigInt("44941127272049826721201904734628716258498742255959991581049806490182030242267"),
    s: BigInt("9910254599581058084911561569808925251374718953855182016200087235935345969636"),
    usePrecompile
  })

/**
 * RIP-7212's test vector (hash ‖ r ‖ s ‖ x ‖ y): the P-256 precompile at `0x100` answers 1 for it where it exists.
 *
 * @internal
 */
export const precompileProbe = {
  to: "0x0000000000000000000000000000000000000100",
  data: Hex.concat(
    "0x4cee90eb86eaa050036147a12d49004b6b9c72bd725d39d4785011fe190f0b4d",
    "0xa73bd4903f0ce3b639bbbf6e8e80d16931ff4bcf5993d58468e8fb19086e8cac",
    "0x36dbcd03009df8c59286b162af3bd7fcc0450c9aa81be5d10d312af6c66b1d60",
    "0x4aebd3099c618202fcfe16ae7770b0c49ab5eadf74b754204a3bb6060e44eff3",
    "0x7618b065f9832de4ca6ca971a7a1adc826d0f7c00181a5fb2ddf79ae00b4e10e"
  )
} as const

/**
 * Whether the precompile's answer to `precompileProbe` says it exists.
 *
 * @internal
 */
export const isPrecompileAnswer = (data: Hex.Hex | undefined): boolean =>
  data !== undefined && data !== "0x" && Hex.toBigInt(data) === BigInt(1)
