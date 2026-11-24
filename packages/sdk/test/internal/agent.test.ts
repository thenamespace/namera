import { assert, describe, it } from "@effect/vitest"
import { Policy, Session, SessionKey } from "@namera-ai/sdk"
import { decodeCalls, encodeCalls, SESSION_HOOK_TAG, statedTime } from "@namera-ai/sdk/internal/core/agent/calls"
import { domainless, encodeSignature, nest } from "@namera-ai/sdk/internal/core/agent/erc7739"
import { isLane, nonceKey } from "@namera-ai/sdk/internal/core/agent/nonce"
import { ecdsaSignature, stubSignature } from "@namera-ai/sdk/internal/core/agent/sessionSignature"
import { encodeEnableSignature } from "@namera-ai/sdk/internal/core/grant/enable"
import * as FastLz from "@namera-ai/sdk/internal/core/grant/fastLz"
import { contracts } from "@namera-ai/sdk/internal/session/contracts"
import * as AbiParameters from "ox/AbiParameters"
import * as Hex from "ox/Hex"
import * as TypedData from "ox/TypedData"

const account: Hex.Hex = "0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc"
const smartSession: Hex.Hex = "0x00000000000000000000000000000000005e5510"
const token: Hex.Hex = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
const recipient: Hex.Hex = "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65"
const permissionId = `0x${"ab".repeat(32)}` as const
const transfer = { to: token, data: "0xa9059cbb0000" as Hex.Hex }

describe("nonce lanes", () => {
  it("put the lane in each account's free bits, keeping Smart Sessions' validator", () => {
    const validator = BigInt(smartSession)
    assert.strictEqual(nonceKey("kernel", smartSession, 0), (BigInt(1) << BigInt(176)) | (validator << BigInt(16)))
    assert.strictEqual(nonceKey("kernel", smartSession, 0xffff) - nonceKey("kernel", smartSession, 0), BigInt(0xffff))
    assert.strictEqual(nonceKey("nexus", smartSession, 5), (BigInt(5) << BigInt(168)) | validator)
    assert.strictEqual(nonceKey("safe7579", smartSession, 7), (validator << BigInt(32)) | BigInt(7))
    // Keys stay within the EntryPoint's 192 bits.
    for (const type of ["kernel", "nexus", "safe7579"] as const) {
      assert.isTrue(nonceKey(type, smartSession, 2 ** 16 - 1) < BigInt(1) << BigInt(192))
    }
  })

  it("range from 0 to each account's free bits", () => {
    assert.isTrue(isLane("kernel", 2 ** 16 - 1))
    assert.isFalse(isLane("kernel", 2 ** 16))
    assert.isTrue(isLane("nexus", 2 ** 24 - 1))
    assert.isFalse(isLane("nexus", 2 ** 24))
    assert.isTrue(isLane("safe7579", 2 ** 32 - 1))
    assert.isFalse(isLane("safe7579", 2 ** 32))
    assert.isFalse(isLane("nexus", -1))
    assert.isFalse(isLane("nexus", 1.5))
  })
})

describe("session operation calldata", () => {
  const calls = [transfer, { to: recipient, value: BigInt(5) }]

  it("decodes what it encodes, with the stated time and tag after `execute`, and Kernel's wrapper", () => {
    for (const type of ["kernel", "nexus"] as const) {
      const callData = encodeCalls({ type, calls, time: BigInt(1_800_000_000), tag: permissionId })
      assert.strictEqual(callData.startsWith("0x8dd7712f"), type === "kernel")
      assert.isTrue(callData.endsWith(SESSION_HOOK_TAG.slice(2)))
      assert.deepStrictEqual(decodeCalls(callData, account), [
        { to: token, value: BigInt(0), data: transfer.data },
        { to: recipient, value: BigInt(5), data: "0x" }
      ])
      assert.strictEqual(statedTime(callData), BigInt(1_800_000_000))
    }
    const single = encodeCalls({ type: "safe7579", calls: [transfer] })
    assert.deepStrictEqual(decodeCalls(single, account), [{ to: token, value: BigInt(0), data: transfer.data }])
    assert.isUndefined(statedTime(single))
  })

  it("reads another function as one call to the account, and refuses other execution modes", () => {
    assert.deepStrictEqual(decodeCalls("0x12345678", account), [{ to: account, value: BigInt(0), data: "0x12345678" }])
    const tryMode = Hex.concat("0xe9ae5c53", "0x00ff", Hex.slice(encodeCalls({ type: "nexus", calls: [transfer] }), 6))
    assert.isUndefined(decodeCalls(tryMode, account))
  })
})

describe("session signatures", () => {
  it("orders ECDSA signatures by signer, and sizes stubs like real signatures", () => {
    const a = { signer: "0x0000000000000000000000000000000000000002" as const, signature: "0xaa" as const }
    const b = { signer: "0x0000000000000000000000000000000000000001" as const, signature: "0xbb" as const }
    assert.strictEqual(ecdsaSignature([a, b]), "0xbbaa")

    const sessionKey = SessionKey.ecdsaThreshold({ threshold: 2, signers: [account, recipient, token] })
    assert.strictEqual(Hex.size(stubSignature(sessionKey, { precompile: false })), 130)
    // A stub doesn't compress better than a real signature would.
    const stub = stubSignature(sessionKey, { precompile: false })
    assert.isAtLeast(Hex.size(FastLz.compress(stub)), Hex.size(stub))
  })

  it("encodes ENABLE mode, compressed, with the agent's chain picked from the grant's", () => {
    const session = Session.from({
      signer: SessionKey.ecdsa(recipient),
      validUntil: 2_000_000_000,
      policies: [Policy.erc20Transfer({ token, amount: { lte: BigInt(5) } })]
    })
    const grant = {
      account: `eip155:10:${account}` as const,
      session,
      chains: [10, 8453].map((chainId) => ({
        chain: `eip155:${chainId}` as const,
        contracts,
        nonce: BigInt(0),
        sessionDigest: Hex.padLeft(Hex.fromNumber(chainId), 32),
        signature: Hex.padLeft(Hex.fromNumber(chainId), 65)
      }))
    }
    const sessionKeySignature = Hex.padLeft("0x5e", 65)
    const encoded = encodeEnableSignature(grant, 8453, sessionKeySignature)
    assert.strictEqual(Hex.slice(encoded, 0, 1), "0x01")
    const [enable, signature] = AbiParameters.decode(
      AbiParameters.from([
        "(uint8 chainDigestIndex, (uint64 chainId, bytes32 sessionDigest)[] hashesAndChainIds)",
        "bytes"
      ]),
      FastLz.decompress(Hex.slice(encoded, 1))
    )
    assert.strictEqual(enable.chainDigestIndex, 1)
    assert.deepStrictEqual(enable.hashesAndChainIds.map((entry) => entry.chainId), [BigInt(10), BigInt(8453)])
    assert.strictEqual(signature, sessionKeySignature)
  })

  it("nests the app's typed data for the account, bound to the hash the app asks about", () => {
    const typedData = {
      domain: { name: "Token", version: "1", chainId: 1, verifyingContract: token },
      types: { Permit: [{ name: "spender", type: "address" }, { name: "value", type: "uint256" }] },
      primaryType: "Permit",
      message: { spender: recipient, value: BigInt(5) }
    } as const
    const nested = nest(typedData, domainless(1, account))
    assert.strictEqual(nested.hash, TypedData.getSignPayload(typedData))
    assert.strictEqual(nested.contentsType, "Permit(address spender,uint256 value)")
    assert.notStrictEqual(nest(typedData, domainless(2, account)).digest, nested.digest)

    const signature = encodeSignature({
      type: "kernel",
      smartSession,
      permissionId,
      sessionKeySignature: "0x11",
      nested
    })
    assert.isTrue(signature.startsWith(Hex.concat("0x01", smartSession)))
    // Ends with the contents type and its length.
    assert.isTrue(
      signature.endsWith(
        Hex.concat(Hex.fromString(nested.contentsType), Hex.fromNumber(nested.contentsType.length, { size: 2 })).slice(
          2
        )
      )
    )
  })
})
