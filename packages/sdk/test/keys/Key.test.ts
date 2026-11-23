import { assert, describe, it } from "@effect/vitest"
import { Key, Keystore, KeystoreError } from "@namera-ai/sdk"
import * as Effect_ from "@namera-ai/sdk/effect"
import { Effect, Exit } from "effect"
import { privateKeyToAccount } from "viem/accounts"

// Hardhat's first development key and its address.
const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
const publicKey = privateKeyToAccount(privateKey).publicKey
const key: Key.Key = { id: "dev", label: undefined, curve: "secp256k1", publicKey, createdAt: 0 }

const reasonTag = (thunk: () => unknown) => {
  try {
    thunk()
  } catch (error) {
    assert.isTrue(KeystoreError.isKeystoreError(error))
    return (error as KeystoreError.KeystoreError).reason._tag
  }
  return assert.fail("expected a KeystoreError")
}

describe("Key", () => {
  it("derives the checksummed EVM address of a secp256k1 key", () => {
    assert.strictEqual(Key.address(key, "eip155"), "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")
  })

  it("formats the CAIP-10 account id on a chain", () => {
    assert.strictEqual(Key.caip10(key, "eip155:8453"), "eip155:8453:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")
  })

  it("throws CurveUnsupported for an EVM address of another curve, NamespaceUnsupported for later namespaces", async () => {
    const p256 = await Keystore.create(Keystore.memory(), { curve: "p256" })

    assert.strictEqual(reasonTag(() => Key.address(p256, "eip155")), "CurveUnsupported")
    assert.strictEqual(reasonTag(() => Key.address(key, "solana")), "NamespaceUnsupported")
    assert.strictEqual(reasonTag(() => Key.caip10(key, "tron:0x2b6653dc")), "NamespaceUnsupported")
  })

  it("recognises keys", () => {
    assert.isTrue(Key.isKey(key))
    assert.isFalse(Key.isKey({ ...key, curve: "rsa" }))
    assert.isFalse(Key.isKey("0x1234"))
  })

  it("fails in the Effect API's error channel instead of throwing", async () => {
    assert.strictEqual(
      await Effect.runPromise(Effect_.Key.address(key, "eip155")),
      "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    )
    assert.isTrue(Exit.isFailure(await Effect.runPromiseExit(Effect_.Key.address(key, "solana"))))
  })
})
