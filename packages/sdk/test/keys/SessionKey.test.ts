import { assert, describe, it } from "@effect/vitest"
import { SessionKey, SessionKeyError } from "@namera-ai/sdk"
import * as Effect_ from "@namera-ai/sdk/effect"
import { Effect, Exit } from "effect"
import * as fs from "node:fs"

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

  it("fails in the Effect API's error channel, with the same reasons", async () => {
    assert.deepStrictEqual(
      await Effect.runPromise(Effect_.SessionKey.ecdsa(c!)),
      SessionKey.ecdsa(c!)
    )
    const exit = await Effect.runPromiseExit(Effect_.SessionKey.ecdsaThreshold({ threshold: 2, signers: [a!] }))
    assert.isTrue(Exit.isFailure(exit))
  })
})
