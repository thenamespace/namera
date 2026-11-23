import * as AbiFunction from "ox/AbiFunction"
import * as AbiParameters from "ox/AbiParameters"
import * as Base64 from "ox/Base64"
import * as Bytes from "ox/Bytes"
import * as Hash from "ox/Hash"
import * as Hex from "ox/Hex"
import * as PublicKey from "ox/PublicKey"
import * as TypedData from "ox/TypedData"

// The encodings of Namera's `WebAuthnValidator` (contracts/src/validators/WebAuthnValidator.sol): what an account
// installs it with, the packed signature it reads, and the digests passkeys sign.

/**
 * A passkey as the validator stores it: its P-256 public key, and whether assertions need the User Verified flag.
 *
 * @internal
 */
export interface Passkey {
  readonly publicKey: Hex.Hex
  readonly requireUserVerification: boolean
}

/**
 * One WebAuthn assertion: what a passkey returned for a challenge, with where `clientDataJSON` holds its fields.
 *
 * @internal
 */
export interface Assertion {
  readonly credentialId: Hex.Hex
  readonly r: bigint
  readonly s: bigint
  readonly challengeIndex: number
  readonly typeIndex: number
  readonly authenticatorData: Hex.Hex
  readonly clientDataJSON: string
}

/**
 * A multichain signature's root and the proof that a user operation hash is one of its leaves.
 *
 * @internal
 */
export interface Multichain {
  readonly root: Hex.Hex
  readonly proof: ReadonlyArray<Hex.Hex>
}

// P-256's group order and half of it: the validator accepts only low-s signatures.
const n = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551")
const halfN = n / BigInt(2)

/**
 * An assertion from a passkey's answer: the signature with `s` made low, and the field indexes the authenticator
 * library reported, or found in `clientDataJSON` when it did not.
 *
 * @internal
 */
export const toAssertion = (options: {
  readonly publicKey: Hex.Hex
  readonly r: bigint
  readonly s: bigint
  readonly authenticatorData: Hex.Hex
  readonly clientDataJSON: string
  readonly challengeIndex?: number | undefined
  readonly typeIndex?: number | undefined
}): Assertion => ({
  credentialId: credentialId(options.publicKey),
  r: options.r,
  s: options.s > halfN ? n - options.s : options.s,
  challengeIndex: options.challengeIndex ?? options.clientDataJSON.indexOf("\"challenge\":\""),
  typeIndex: options.typeIndex ?? options.clientDataJSON.indexOf("\"type\":\"webauthn.get\""),
  authenticatorData: options.authenticatorData,
  clientDataJSON: options.clientDataJSON
})

const passkeysParameters = AbiParameters.from([
  "uint256 threshold",
  "(bytes32 x, bytes32 y, bool requireUserVerification, bytes32 rpIdHash)[] passkeys"
])

const zeroHash: Hex.Hex = "0x0000000000000000000000000000000000000000000000000000000000000000"
const stubWord: Hex.Hex = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"

const coordinates = (publicKey: Hex.Hex) => {
  const { x, y } = PublicKey.fromHex(publicKey)
  return { x: Hex.padLeft(x, 32), y: Hex.padLeft(y, 32) }
}

/**
 * The validator's id of a passkey: `keccak256(abi.encode(x, y))`.
 *
 * @internal
 */
export const credentialId = (publicKey: Hex.Hex): Hex.Hex => {
  const { x, y } = coordinates(publicKey)
  return Hash.keccak256(AbiParameters.encode(AbiParameters.from(["bytes32", "bytes32"]), [x, y]))
}

/**
 * The validator's install data, also its stateless session config: `abi.encode(threshold, passkeys)`.
 *
 * @internal
 */
export const installData = (options: {
  readonly threshold: number
  readonly passkeys: ReadonlyArray<Passkey>
}): Hex.Hex =>
  AbiParameters.encode(passkeysParameters, [
    BigInt(options.threshold),
    options.passkeys.map((passkey) => ({
      ...coordinates(passkey.publicKey),
      requireUserVerification: passkey.requireUserVerification,
      rpIdHash: zeroHash
    }))
  ])

/**
 * The validator's packed signature: `mode ‖ backend ‖ [root ‖ proofLength ‖ proof] ‖ count ‖ assertions`, the
 * assertions sorted by credential id as the validator requires.
 *
 * @internal
 */
export const encodeSignature = (options: {
  readonly precompile: boolean
  readonly multichain?: Multichain | undefined
  readonly assertions: ReadonlyArray<Assertion>
}): Hex.Hex => {
  const assertions = [...options.assertions].sort((a, b) =>
    // Stryker disable next-line EqualityOperator: credential ids of distinct passkeys never collide
    Hex.toBigInt(a.credentialId) < Hex.toBigInt(b.credentialId) ? -1 : 1
  )
  const header = options.multichain === undefined
    ? [Hex.fromNumber(0, { size: 1 }), backend(options.precompile)]
    : [
      Hex.fromNumber(1, { size: 1 }),
      backend(options.precompile),
      options.multichain.root,
      Hex.fromNumber(options.multichain.proof.length, { size: 1 }),
      ...options.multichain.proof
    ]
  return Hex.concat(
    ...header,
    Hex.fromNumber(assertions.length, { size: 1 }),
    ...assertions.map(encodeAssertion)
  )
}

const backend = (precompile: boolean) => Hex.fromNumber(precompile ? 0 : 1, { size: 1 })

const encodeAssertion = (assertion: Assertion): Hex.Hex => {
  const clientDataJSON = Hex.fromString(assertion.clientDataJSON)
  return Hex.concat(
    assertion.credentialId,
    Hex.fromNumber(assertion.r, { size: 32 }),
    Hex.fromNumber(assertion.s, { size: 32 }),
    Hex.fromNumber(assertion.challengeIndex, { size: 2 }),
    Hex.fromNumber(assertion.typeIndex, { size: 2 }),
    Hex.fromNumber(Hex.size(assertion.authenticatorData), { size: 2 }),
    assertion.authenticatorData,
    Hex.fromNumber(Hex.size(clientDataJSON), { size: 2 }),
    clientDataJSON
  )
}

/**
 * What a passkey signs for an ERC-1271 check of `hash` on `account`: an EIP-712 digest in the validator's domain.
 *
 * @internal
 */
export const replaySafeHash = (options: {
  readonly validator: Hex.Hex
  readonly chainId: number
  readonly account: Hex.Hex
  readonly hash: Hex.Hex
}): Hex.Hex =>
  TypedData.getSignPayload({
    domain: { name: "WebAuthnValidator", version: "1", chainId: options.chainId, verifyingContract: options.validator },
    types: { ReplaySafeHash: [{ name: "account", type: "address" }, { name: "hash", type: "bytes32" }] },
    primaryType: "ReplaySafeHash",
    message: { account: options.account, hash: options.hash }
  })

const multichainTypeHash = Hash.keccak256(Hex.fromString("WebAuthnMultichain(bytes32 root)"))

/**
 * What passkeys sign to approve every user operation under a multichain root.
 *
 * @internal
 */
export const multichainChallenge = (root: Hex.Hex): Hex.Hex =>
  Hash.keccak256(AbiParameters.encode(AbiParameters.from(["bytes32", "bytes32"]), [multichainTypeHash, root]))

const leaf = (userOperationHash: Hex.Hex): Hex.Hex =>
  Hash.keccak256(AbiParameters.encode(AbiParameters.from(["bytes32"]), [userOperationHash]))

const parent = (a: Hex.Hex, b: Hex.Hex): Hex.Hex =>
  // Stryker disable next-line EqualityOperator: two nodes of a tree are never equal
  Hex.toBigInt(a) < Hex.toBigInt(b) ? Hash.keccak256(Hex.concat(a, b)) : Hash.keccak256(Hex.concat(b, a))

/**
 * The Merkle tree over user operation hashes (leaves `keccak256(abi.encode(hash))`, sorted pairs, an odd node moves
 * up as is): its root, and each hash's proof in input order.
 *
 * @internal
 */
export const multichainTree = (
  userOperationHashes: ReadonlyArray<Hex.Hex>
): { readonly root: Hex.Hex; readonly proofs: ReadonlyArray<ReadonlyArray<Hex.Hex>> } => {
  let level = userOperationHashes.map(leaf)
  // Where each input's node is in the current level.
  let positions = userOperationHashes.map((_, index) => index)
  const proofs: Array<Array<Hex.Hex>> = userOperationHashes.map(() => [])

  while (level.length > 1) {
    positions.forEach((position, index) => {
      const sibling = position % 2 === 0 ? position + 1 : position - 1
      if (sibling < level.length) proofs[index]!.push(level[sibling]!)
    })
    const next: Array<Hex.Hex> = []
    for (let i = 0; i < level.length; i += 2) {
      next.push(i + 1 < level.length ? parent(level[i]!, level[i + 1]!) : level[i]!)
    }
    level = next
    positions = positions.map((position) => Math.floor(position / 2))
  }
  return { root: level[0]!, proofs }
}

// A Chrome-shaped assertion with a long extra key, so a stub is no smaller than a real assertion; r and s are in range
// so the Solidity backend runs its full verification during estimation.
const stubAssertion = {
  r: BigInt("0x6f4c1f3a96e8de29b4b5c0f0f9e7f7a3e4a1b8d5c2f6e9a0b3c7d1e4f8a2b5c9"),
  s: BigInt("0x2a7e5b8c1d4f6a9e3b7c0d2f5a8e1b4c7d0a3f6e9b2c5d8a1e4f7b0c3d6e9a2b"),
  challengeIndex: 23,
  typeIndex: 1,
  // Stryker disable next-line StringLiteral: any rpId hash makes a stub of the same size
  authenticatorData: Hex.concat(Hash.sha256(Hex.fromString("localhost")), "0x1d00000000"),
  clientDataJSON: `{"type":"webauthn.get","challenge":"${
    Base64.fromBytes(Bytes.fromHex(stubWord), { url: true, pad: false })
  }","origin":"https://localhost","crossOrigin":false,"other_keys_can_be_added_here":"do not compare clientDataJSON against a template. See https://goo.gl/yabPex"}`
}

/**
 * A signature of the real one's shape for gas estimation: one assertion per signing passkey, the same backend, and
 * the same multichain proof length.
 *
 * @internal
 */
export const stubSignature = (options: {
  readonly precompile: boolean
  readonly credentialIds: ReadonlyArray<Hex.Hex>
  readonly multichainProofLength?: number | undefined
}): Hex.Hex =>
  encodeSignature({
    precompile: options.precompile,
    // Non-zero filler: zero calldata bytes cost less, and the estimate must cover a real root and proof.
    multichain: options.multichainProofLength === undefined
      ? undefined
      : { root: stubWord, proof: Array.from({ length: options.multichainProofLength }, () => stubWord) },
    assertions: options.credentialIds.map((credentialId) => ({ credentialId, ...stubAssertion }))
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

const addPasskeyFunction = AbiFunction.from(
  "function addPasskey((bytes32 x, bytes32 y, bool requireUserVerification, bytes32 rpIdHash) passkey)"
)
const removePasskeyFunction = AbiFunction.from("function removePasskey(bytes32 id)")
const setThresholdFunction = AbiFunction.from("function setThreshold(uint256 threshold)")
const getPasskeysFunction = AbiFunction.from(
  "function getPasskeys(address account) view returns (uint256 threshold, bytes32[] credentialIds, (bytes32 x, bytes32 y, bool requireUserVerification, bytes32 rpIdHash)[] passkeys)"
)

/** The validator's passkey management calls, which the account makes. @internal */
export const management = {
  addPasskey: (passkey: Passkey): Hex.Hex =>
    AbiFunction.encodeData(addPasskeyFunction, [{
      ...coordinates(passkey.publicKey),
      requireUserVerification: passkey.requireUserVerification,
      rpIdHash: zeroHash
    }]),
  removePasskey: (publicKey: Hex.Hex): Hex.Hex =>
    AbiFunction.encodeData(removePasskeyFunction, [credentialId(publicKey)]),
  setThreshold: (threshold: number): Hex.Hex => AbiFunction.encodeData(setThresholdFunction, [BigInt(threshold)])
}

/**
 * An account's passkeys and threshold as `getPasskeys` returns them.
 *
 * @internal
 */
export interface Installed {
  readonly threshold: number
  readonly passkeys: ReadonlyArray<{ readonly credentialId: Hex.Hex; readonly publicKey: Hex.Hex } & Passkey>
}

/** The validator's `getPasskeys(account)` view. @internal */
export const encodeGetPasskeys = (account: Hex.Hex): Hex.Hex => AbiFunction.encodeData(getPasskeysFunction, [account])

/** Decodes `getPasskeys`. @internal */
export const decodeGetPasskeys = (result: Hex.Hex): Installed => {
  const [threshold, ids, passkeys] = AbiFunction.decodeResult(getPasskeysFunction, result)
  return {
    threshold: Number(threshold),
    passkeys: passkeys.map((passkey, index) => ({
      credentialId: ids[index]!,
      publicKey: Hex.concat("0x04", passkey.x, passkey.y),
      requireUserVerification: passkey.requireUserVerification
    }))
  }
}
