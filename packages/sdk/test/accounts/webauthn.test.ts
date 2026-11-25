import { assert, describe, it } from "@effect/vitest"
import * as WebAuthn from "@namera-ai/sdk/internal/core/account/webauthn"
import * as AbiParameters from "ox/AbiParameters"
import * as Hash from "ox/Hash"
import * as Hex from "ox/Hex"
import * as P256 from "ox/P256"
import * as PublicKey from "ox/PublicKey"

const n = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551")

const publicKey = () => PublicKey.toHex(P256.getPublicKey({ privateKey: P256.randomPrivateKey() }))

const assertion = (credentialId: Hex.Hex): WebAuthn.Assertion => ({
  credentialId,
  r: BigInt(1),
  s: BigInt(2),
  challengeIndex: 23,
  typeIndex: 1,
  authenticatorData: "0x0102",
  clientDataJSON: "{}"
})

// Recomputes a root from a leaf and its proof, as Solady's MerkleProofLib does.
const rootOf = (hash: Hex.Hex, proof: ReadonlyArray<Hex.Hex>) =>
  proof.reduce(
    (node, sibling) =>
      Hex.toBigInt(node) < Hex.toBigInt(sibling)
        ? Hash.keccak256(Hex.concat(node, sibling))
        : Hash.keccak256(Hex.concat(sibling, node)),
    Hash.keccak256(AbiParameters.encode(AbiParameters.from(["bytes32"]), [hash]))
  )

describe("WebAuthnValidator encodings", () => {
  it("packs a direct signature: mode, backend, count, then assertions sorted by credential id", () => {
    const [low, high] = ["0x01", "0x02"].map((byte) => Hex.padLeft(byte as Hex.Hex, 32))
    const signature = WebAuthn.encodeSignature({
      precompile: false,
      assertions: [assertion(high!), assertion(low!)]
    })

    assert.strictEqual(Hex.slice(signature, 0, 3), "0x000102")
    assert.strictEqual(Hex.slice(signature, 3, 35), low)
    const first = 3 + 32 + 32 + 32 + 2 + 2 + 2 + 2 + 2 + 2
    assert.strictEqual(Hex.slice(signature, first, first + 32), high)
    assert.strictEqual(Hex.size(signature), 3 + 2 * (first - 3))
  })

  it("encodes an assertion's fields with their lengths", () => {
    const id = Hex.padLeft("0x01", 32)
    const signature = WebAuthn.encodeSignature({ precompile: true, assertions: [assertion(id)] })

    assert.strictEqual(Hex.slice(signature, 0, 3), "0x000001")
    assert.strictEqual(
      Hex.slice(signature, 35),
      Hex.concat(
        Hex.fromNumber(1, { size: 32 }),
        Hex.fromNumber(2, { size: 32 }),
        "0x0017",
        "0x0001",
        "0x0002",
        "0x0102",
        "0x0002",
        Hex.fromString("{}")
      )
    )
  })

  it("packs a multichain signature with its root and proof", () => {
    const root = Hex.padLeft("0xaa", 32)
    const proof = [Hex.padLeft("0xbb", 32), Hex.padLeft("0xcc", 32)]
    const signature = WebAuthn.encodeSignature({
      precompile: true,
      multichain: { root, proof },
      assertions: [assertion(Hex.padLeft("0x01", 32))]
    })

    assert.strictEqual(Hex.slice(signature, 0, 2), "0x0100")
    assert.strictEqual(Hex.slice(signature, 2, 34), root)
    assert.strictEqual(Hex.slice(signature, 34, 35), "0x02")
    assert.strictEqual(Hex.slice(signature, 35, 99), Hex.concat(...proof))
    assert.strictEqual(Hex.slice(signature, 99, 100), "0x01")
  })

  it("turns a passkey's answer into an assertion with low s, finding missing field indexes", () => {
    const key = publicKey()
    const clientDataJSON = `{"challenge":"abc","type":"webauthn.get"}`
    const high = WebAuthn.toAssertion({
      publicKey: key,
      r: BigInt(5),
      s: n - BigInt(7),
      authenticatorData: "0x00",
      clientDataJSON
    })

    assert.strictEqual(high.s, BigInt(7))
    assert.strictEqual(high.challengeIndex, 1)
    assert.strictEqual(high.typeIndex, 19)
    assert.strictEqual(high.credentialId, WebAuthn.credentialId(key))

    const reported = WebAuthn.toAssertion({
      publicKey: key,
      r: BigInt(5),
      s: BigInt(7),
      authenticatorData: "0x00",
      clientDataJSON,
      challengeIndex: 3,
      typeIndex: 4
    })
    assert.strictEqual(reported.s, BigInt(7))
    assert.strictEqual(reported.challengeIndex, 3)
    assert.strictEqual(reported.typeIndex, 4)
  })

  it("keeps s at exactly n / 2, the highest low s", () => {
    const half = n / BigInt(2)
    const at = (s: bigint) =>
      WebAuthn.toAssertion({ publicKey: publicKey(), r: BigInt(1), s, authenticatorData: "0x00", clientDataJSON: "" })

    assert.strictEqual(at(half).s, half)
    assert.strictEqual(at(half + BigInt(1)).s, n - half - BigInt(1))
  })

  it("encodes install data the validator decodes: threshold and passkeys with User Verification", () => {
    const keys = [publicKey(), publicKey()]
    const data = WebAuthn.installData({
      threshold: 2,
      passkeys: keys.map((key, index) => ({ publicKey: key, requireUserVerification: index === 0 }))
    })
    const [threshold, passkeys] = AbiParameters.decode(
      AbiParameters.from(["uint256", "(bytes32 x, bytes32 y, bool requireUserVerification, bytes32 rpIdHash)[]"]),
      data
    )

    assert.strictEqual(threshold, BigInt(2))
    assert.strictEqual(passkeys.length, 2)
    assert.strictEqual(Hex.concat("0x04", passkeys[1]!.x, passkeys[1]!.y), keys[1])
    assert.isTrue(passkeys[0]!.requireUserVerification)
    assert.isFalse(passkeys[1]!.requireUserVerification)
    assert.strictEqual(passkeys[0]!.rpIdHash, Hex.padLeft("0x00", 32))
  })

  it("builds a Merkle tree whose proofs lead every hash to the root", () => {
    for (let count = 1; count <= 7; count++) {
      const hashes = Array.from({ length: count }, (_, index) => Hash.keccak256(Hex.fromNumber(index, { size: 32 })))
      const { proofs, root } = WebAuthn.multichainTree(hashes)

      hashes.forEach((hash, index) => {
        assert.strictEqual(rootOf(hash, proofs[index]!), root)
        assert.isAtMost(proofs[index]!.length, Math.ceil(Math.log2(count)))
      })
    }
  })

  it("builds a stub with one assertion per signer, the backend, and a proof of the given length", () => {
    const ids = [Hex.padLeft("0x02", 32), Hex.padLeft("0x01", 32)]
    const direct = WebAuthn.stubSignature({ precompile: true, credentialIds: ids })
    const multichain = WebAuthn.stubSignature({ precompile: false, credentialIds: ids, multichainProofLength: 3 })

    assert.strictEqual(Hex.slice(direct, 0, 3), "0x000002")
    assert.strictEqual(Hex.slice(direct, 3, 35), ids[1])
    assert.strictEqual(Hex.slice(multichain, 0, 2), "0x0101")
    assert.strictEqual(Hex.slice(multichain, 34, 35), "0x03")
    assert.strictEqual(Hex.size(multichain) - Hex.size(direct), 32 + 1 + 3 * 32)
    // Calldata zero bytes are cheaper: a stub root and proof must cost what real ones do.
    assert.notInclude(Hex.slice(multichain, 2, 131), "00")
  })
})

describe("the stub signature", () => {
  it("is a well-formed, Chrome-sized assertion, so estimation pays for a full P-256 verification", () => {
    const id = Hex.padLeft("0x01", 32)
    const stub = WebAuthn.stubSignature({ precompile: false, credentialIds: [id] })
    const r = Hex.toBigInt(Hex.slice(stub, 35, 67))
    const s = Hex.toBigInt(Hex.slice(stub, 67, 99))
    const clientDataLength = Hex.toNumber(Hex.slice(stub, 105 + 37, 107 + 37))
    const clientDataJSON = Hex.toString(Hex.slice(stub, 107 + 37))

    assert.isTrue(r > BigInt(0) && r < n)
    assert.isTrue(s > BigInt(0) && s <= n / BigInt(2))
    assert.strictEqual(Hex.toNumber(Hex.slice(stub, 99, 101)), 23)
    assert.strictEqual(Hex.toNumber(Hex.slice(stub, 101, 103)), 1)
    assert.strictEqual(Hex.toNumber(Hex.slice(stub, 103, 105)), 37)
    assert.strictEqual(clientDataLength, Hex.size(Hex.fromString(clientDataJSON)))
    assert.isAtLeast(clientDataLength, 200)
    assert.match(clientDataJSON.slice(1, 22), /^"type":"webauthn\.get"$/)
    assert.match(clientDataJSON.slice(23, 80), /^"challenge":"[\w-]{43}"$/)
  })
})

describe("the P-256 precompile probe", () => {
  it("counts only an answer of 1 as the precompile", () => {
    assert.isTrue(WebAuthn.isPrecompileAnswer(`0x${"00".repeat(31)}01`))
    assert.isFalse(WebAuthn.isPrecompileAnswer(`0x${"00".repeat(31)}02`))
    assert.isFalse(WebAuthn.isPrecompileAnswer(`0x${"00".repeat(32)}`))
    // No code at 0x100 answers with empty data; a node without the precompile may answer nothing.
    assert.isFalse(WebAuthn.isPrecompileAnswer("0x"))
    assert.isFalse(WebAuthn.isPrecompileAnswer(undefined))
  })
})
