import { assert, describe, it } from "@effect/vitest"
import { Key, Keystore, KeystoreError } from "@namera-ai/sdk"
import * as Ed25519 from "ox/Ed25519"
import * as P256 from "ox/P256"
import * as PublicKey from "ox/PublicKey"
import * as Signature from "ox/Signature"
import { recoverAddress } from "viem"

const digest = `0x${"5a".repeat(32)}` as const

export const rejection = (promise: Promise<unknown>) =>
  promise.then(
    () => assert.fail("expected a rejection"),
    (error: unknown) => error
  )

export const reasonOf = (error: unknown) => {
  assert.isTrue(KeystoreError.isKeystoreError(error), String(error))
  return (error as KeystoreError.KeystoreError).reason
}

/** Whether `signature` is the key's signature of the digest, by the key's curve. */
export const verifies = async (key: Key.Key, signature: `0x${string}`): Promise<boolean> => {
  switch (key.curve) {
    case "secp256k1":
      return (await recoverAddress({ hash: digest, signature })) === Key.address(key, "eip155")
    case "p256":
      return P256.verify({
        payload: digest,
        publicKey: PublicKey.fromHex(key.publicKey),
        signature: Signature.from({ r: `0x${signature.slice(2, 66)}`, s: `0x${signature.slice(66, 130)}`, yParity: 0 })
      })
    case "ed25519":
      return Ed25519.verify({ payload: digest, publicKey: key.publicKey, signature })
  }
}

/**
 * The behaviour every key store must have: keys are created, listed, read, signed with and removed; an unknown id is
 * `NotFound`; a curve the store lacks is `CurveUnsupported`; a malformed digest is `InvalidDigest`.
 */
export const conformance = (
  name: string,
  open: () => Keystore.Keystore | Promise<Keystore.Keystore>,
  curves: ReadonlyArray<Key.Curve>
) =>
  describe(`${name}: the store conformance suite`, { concurrent: false }, () => {
    for (const curve of curves) {
      it(`creates, lists, reads, signs with and removes a ${curve} key`, async () => {
        const store = await open()
        const key = await Keystore.create(store, { curve, label: "agent" })

        assert.strictEqual(key.curve, curve)
        assert.strictEqual(key.label, "agent")
        assert.isTrue(Key.isKey(key))
        assert.deepStrictEqual(await Keystore.get(store, { id: key.id }), key)
        assert.deepInclude(await Keystore.list(store), key)

        const signature = await Keystore.sign(store, { id: key.id, digest })
        assert.isTrue(await verifies(key, signature))

        await Keystore.remove(store, { id: key.id })
        assert.strictEqual(reasonOf(await rejection(Keystore.get(store, { id: key.id })))._tag, "NotFound")
        assert.notDeepInclude(await Keystore.list(store), key)
      })
    }

    it("fails with NotFound for an unknown id, on every operation", async () => {
      const store = await open()
      for (
        const promise of [
          Keystore.get(store, { id: "missing" }),
          Keystore.remove(store, { id: "missing" }),
          Keystore.sign(store, { id: "missing", digest })
        ]
      ) {
        const reason = reasonOf(await rejection(promise))
        assert.strictEqual(reason._tag, "NotFound")
      }
    })

    it("fails with InvalidDigest for a digest that is not 32 bytes", async () => {
      const store = await open()
      const key = await Keystore.create(store, { curve: curves[0]! })

      const reason = reasonOf(await rejection(Keystore.sign(store, { id: key.id, digest: "0x1234" })))
      assert.strictEqual(reason._tag, "InvalidDigest")
    })

    for (const curve of (["secp256k1", "ed25519", "p256"] as const).filter((curve) => !curves.includes(curve))) {
      it(`fails with CurveUnsupported for ${curve}, naming the curves it supports`, async () => {
        const store = await open()
        const reason = reasonOf(await rejection(Keystore.create(store, { curve })))

        assert.strictEqual(reason._tag, "CurveUnsupported")
        assert.deepStrictEqual(reason._tag === "CurveUnsupported" ? reason.supported : undefined, curves)
      })
    }
  })
