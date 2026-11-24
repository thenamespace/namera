import { assert, describe, it } from "@effect/vitest"
import { SessionKey, SessionKeyError } from "@namera-ai/sdk"
import * as fs from "node:fs"
import * as P256 from "ox/P256"
import * as PublicKey from "ox/PublicKey"
import { decodeAbiParameters, parseAbiParameters } from "viem"

import * as WebAuthn from "@namera-ai/sdk/internal/core/account/webauthn"

// The vectors the Foundry tests check against ECDSASessionValidator (contracts/test/unit/validators).
const { vectors } = JSON.parse(
  fs.readFileSync(new URL("../../../../contracts/test/fixtures/session-keys.json", import.meta.url), "utf8")
) as {
  readonly vectors: ReadonlyArray<{
    readonly name: string
    readonly threshold: number
    readonly signers: ReadonlyArray<`0x${string}`>
    readonly config: `0x${string}`
  }>
}

const [a, b, c] = vectors[1]!.signers

const reasonOf = (thunk: () => unknown) => {
  try {
    thunk()
  } catch (error) {
    assert.isTrue(SessionKeyError.isSessionKeyError(error))
    return (error as SessionKeyError.SessionKeyError).reason
  }
  return assert.fail("expected a SessionKeyError")
}

describe("SessionKey", () => {
  for (const vector of vectors) {
    it(`encodes ${vector.name} as ECDSASessionValidator reads it, whatever order the signers come in`, () => {
      const sessionKey = SessionKey.ecdsaThreshold({
        threshold: vector.threshold,
        signers: [...vector.signers].reverse().map((signer) => signer.toLowerCase())
      })

      assert.deepStrictEqual(sessionKey.signers, vector.signers)
      assert.strictEqual(SessionKey.toValidatorData(sessionKey), vector.config)
    })
  }

  it("sorts the signers whatever order they come in", () => {
    const sorted = vectors[1]!.signers
    const orders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]
    for (const order of orders) {
      const signers = order.map((index) => sorted[index]!)
      assert.deepStrictEqual(SessionKey.ecdsaThreshold({ threshold: 2, signers }).signers, sorted)
    }
  })

  it("makes one key a one-of-one session key", () => {
    assert.deepStrictEqual(SessionKey.ecdsa(c!.toLowerCase()), { type: "ecdsa", threshold: 1, signers: [c] })
    assert.isTrue(SessionKey.isSessionKey(SessionKey.ecdsa(c!)))
    assert.isFalse(SessionKey.isSessionKey({ type: "p256" }))
  })

  it("rejects what ECDSASessionValidator could never accept, with the reason", () => {
    assert.deepInclude(reasonOf(() => SessionKey.ecdsa("0x1234")), { _tag: "InvalidAddress", value: "0x1234" })
    // A mixed-case address with a wrong checksum is a typo, not an address.
    const typo = c!.replace("C51812dc", "c51812dc")
    assert.strictEqual(reasonOf(() => SessionKey.ecdsa(typo))._tag, "InvalidAddress")
    assert.strictEqual(reasonOf(() => SessionKey.ecdsaThreshold({ threshold: 1, signers: [] }))._tag, "NoSigners")
    assert.deepInclude(
      reasonOf(() => SessionKey.ecdsaThreshold({ threshold: 1, signers: [a!, b!, a!.toLowerCase()] })),
      { _tag: "DuplicateSigner", signer: a }
    )
    for (const threshold of [0, 4, 1.5, Number.NaN]) {
      assert.deepInclude(
        reasonOf(() => SessionKey.ecdsaThreshold({ threshold, signers: [a!, b!, c!] })),
        { _tag: "InvalidThreshold", signers: 3 }
      )
    }
  })

  it("takes up to 69 signers, what a validator's config holds (2,304 bytes)", () => {
    const signers = Array.from({ length: 70 }, (_, i) => `0x${(i + 1).toString(16).padStart(40, "0")}`)
    const largest = SessionKey.ecdsaThreshold({ threshold: 1, signers: signers.slice(0, 69) })
    assert.strictEqual((SessionKey.toValidatorData(largest).length - 2) / 2, 2304)
    assert.deepInclude(reasonOf(() => SessionKey.ecdsaThreshold({ threshold: 1, signers })), {
      _tag: "TooManySigners",
      signers: 70,
      max: 69
    })
  })

  describe("passkeys", () => {
    // Three P-256 public keys, uncompressed (`0x04 ‖ x ‖ y`).
    const keys = ["0x01", "0x02", "0x03"].map((privateKey) =>
      PublicKey.toHex(P256.getPublicKey({ privateKey: `0x${privateKey.slice(2).padStart(64, "0")}` }))
    )
    const byCredentialId = [...keys].sort((x, y) =>
      BigInt(WebAuthn.credentialId(x)) < BigInt(WebAuthn.credentialId(y)) ? -1 : 1
    )

    it("orders the passkeys by credential id and encodes WebAuthnValidator's config", () => {
      const sessionKey = SessionKey.passkeyThreshold({
        threshold: 2,
        passkeys: [{ publicKey: keys[0]! }, { publicKey: keys[1]!, requireUserVerification: false }, {
          publicKey: keys[2]!.toUpperCase().replace("0X", "0x")
        }]
      })

      assert.deepStrictEqual(sessionKey.passkeys.map((passkey) => passkey.publicKey), byCredentialId)
      assert.strictEqual(
        sessionKey.passkeys.find((passkey) => passkey.publicKey === keys[1])?.requireUserVerification,
        false
      )
      // WebAuthnValidator's install data: the threshold, then (x, y, requireUserVerification, rpIdHash) per passkey.
      const [threshold, passkeys] = decodeAbiParameters(
        parseAbiParameters("uint256, (bytes32 x, bytes32 y, bool requireUserVerification, bytes32 rpIdHash)[]"),
        SessionKey.toValidatorData(sessionKey)
      )
      assert.strictEqual(threshold, 2n)
      assert.deepStrictEqual(passkeys.map(({ x, y }) => `0x04${x.slice(2)}${y.slice(2)}`), byCredentialId)
      assert.deepStrictEqual(
        passkeys.map(({ requireUserVerification }) => requireUserVerification),
        byCredentialId.map((publicKey) => publicKey !== keys[1])
      )
      assert.isTrue(SessionKey.isSessionKey(sessionKey))
    })

    it("takes a 64-byte key without the 0x04 prefix as the same passkey", () => {
      const prefixed = SessionKey.passkey({ publicKey: keys[0]! })
      const bare = SessionKey.passkey({ publicKey: `0x${keys[0]!.slice(4)}` })
      assert.strictEqual(SessionKey.toValidatorData(prefixed), SessionKey.toValidatorData(bare))
    })

    it("rejects malformed and repeated keys, more than 16, and bad thresholds", () => {
      assert.deepInclude(reasonOf(() => SessionKey.passkey({ publicKey: "0x1234" })), {
        _tag: "InvalidPublicKey",
        value: "0x1234"
      })
      assert.strictEqual(
        reasonOf(() => SessionKey.passkey({ publicKey: `0x05${keys[0]!.slice(4)}` }))._tag,
        "InvalidPublicKey"
      )
      assert.strictEqual(reasonOf(() => SessionKey.passkeyThreshold({ threshold: 1, passkeys: [] }))._tag, "NoSigners")
      assert.strictEqual(
        reasonOf(() =>
          SessionKey.passkeyThreshold({
            threshold: 1,
            passkeys: [{ publicKey: keys[0]! }, { publicKey: `0x${keys[0]!.slice(4)}` }]
          })
        )._tag,
        "DuplicateSigner"
      )
      assert.deepInclude(
        reasonOf(() => SessionKey.passkeyThreshold({ threshold: 2, passkeys: [{ publicKey: keys[0]! }] })),
        { _tag: "InvalidThreshold", signers: 1 }
      )
      const seventeen = Array.from({ length: 17 }, (_, i) => ({
        publicKey: PublicKey.toHex(P256.getPublicKey({ privateKey: `0x${(i + 1).toString(16).padStart(64, "0")}` }))
      }))
      assert.deepInclude(reasonOf(() => SessionKey.passkeyThreshold({ threshold: 1, passkeys: seventeen })), {
        _tag: "TooManySigners",
        signers: 17,
        max: 16
      })
    })
  })
})
