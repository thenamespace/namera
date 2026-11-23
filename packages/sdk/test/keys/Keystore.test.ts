import { assert, describe, it } from "@effect/vitest"
import { Key, Keystore, type KeystoreError } from "@namera-ai/sdk"
import * as Effect_ from "@namera-ai/sdk/effect"
import { Effect, Exit } from "effect"
import { parseEther, recoverMessageAddress, recoverTransactionAddress, recoverTypedDataAddress } from "viem"
import { recoverAuthorizationAddress } from "viem/utils"

import { conformance, reasonOf, rejection } from "./keystore.test-utils.ts"

// A cheap key derivation keeps the tests fast; the default (scrypt n = 262144) takes about a second per key.
const kdf = { type: "scrypt", n: 1024 } as const
const password = "correct horse battery staple"

conformance("memory", () => Keystore.memory(), ["secp256k1", "ed25519", "p256"])
conformance("encryptedJson", () => Keystore.encryptedJson({ password, kdf }), ["secp256k1", "ed25519", "p256"])

describe("Keystore.encryptedJson", () => {
  it("exports its keys encrypted and opens the export again", async () => {
    const store = Keystore.encryptedJson({ password, kdf })
    const key = await Keystore.create(store, { curve: "secp256k1" })
    const data = await Keystore.toJson(store)

    assert.notInclude(data, password)
    const reopened = Keystore.encryptedJson({ password, data })
    assert.deepStrictEqual(await Keystore.list(reopened), [key])
    const signature = await Keystore.sign(reopened, { id: key.id, digest: `0x${"01".repeat(32)}` })
    assert.strictEqual(signature.length, 132)
  })

  it("fails with Locked when the password is wrong, once a key is used", async () => {
    const store = Keystore.encryptedJson({ password, kdf })
    const key = await Keystore.create(store, { curve: "secp256k1" })
    const data = await Keystore.toJson(store)

    const reopened = Keystore.encryptedJson({ password: "wrong", data })
    const error = await rejection(Keystore.sign(reopened, { id: key.id, digest: `0x${"01".repeat(32)}` }))
    assert.strictEqual(reasonOf(error)._tag, "Locked")
    assert.notInclude(JSON.stringify((error as KeystoreError.KeystoreError).metaMessages), "wrong")
  })

  it("throws Unavailable for data that is not an export", () => {
    assert.throws(() => Keystore.encryptedJson({ password, data: "{}" }), /not available/)
  })

  it("fails toJson with Unavailable for another store", async () => {
    assert.strictEqual(reasonOf(await rejection(Keystore.toJson(Keystore.memory())))._tag, "Unavailable")
  })
})

describe("Keystore.from", () => {
  it("wraps a backend, turning its failures into Unavailable with the backend's error as cause", async () => {
    const cause = new Error("database offline")
    const store = Keystore.from({
      curves: ["secp256k1"],
      create: () => Promise.reject(cause),
      get: () => Promise.reject(cause),
      list: () => Promise.resolve([]),
      remove: () => Promise.resolve(),
      sign: () => Promise.reject(cause)
    })

    const reason = reasonOf(await rejection(Keystore.get(store, { id: "x" })))
    assert.strictEqual(reason._tag, "Unavailable")
    assert.strictEqual(reason.cause, cause)
    assert.strictEqual(reasonOf(await rejection(Keystore.create(store, { curve: "p256" })))._tag, "CurveUnsupported")
  })
})

describe("Keystore.toAccount", () => {
  it("signs messages, typed data, transactions and authorizations that recover to the key's address", async () => {
    const store = Keystore.memory()
    const key = await Keystore.create(store, { curve: "secp256k1" })
    const account = await Keystore.toAccount(store, { id: key.id })
    const address = Key.address(key, "eip155")

    assert.strictEqual(account.address, address)
    assert.strictEqual(
      await recoverMessageAddress({ message: "hello", signature: await account.signMessage({ message: "hello" }) }),
      address
    )
    const typedData = {
      domain: { name: "Example", version: "1", chainId: 1 },
      types: { Mail: [{ name: "contents", type: "string" }] },
      primaryType: "Mail",
      message: { contents: "hello" }
    } as const
    assert.strictEqual(
      await recoverTypedDataAddress({ ...typedData, signature: await account.signTypedData(typedData) }),
      address
    )
    const transaction = await account.signTransaction({
      chainId: 1,
      type: "eip1559",
      to: address,
      value: parseEther("1"),
      nonce: 0,
      gas: BigInt(21_000),
      maxFeePerGas: BigInt(1),
      maxPriorityFeePerGas: BigInt(1)
    })
    assert.strictEqual(
      await recoverTransactionAddress({ serializedTransaction: transaction as `0x02${string}` }),
      address
    )
    const authorization = await account.signAuthorization!({
      address: "0x0000000000000000000000000000000000000001",
      chainId: 1,
      nonce: 0
    })
    assert.strictEqual(await recoverAuthorizationAddress({ authorization }), address)
  })

  it("fails with CurveUnsupported for a key that is not secp256k1", async () => {
    const store = Keystore.memory()
    const key = await Keystore.create(store, { curve: "p256" })

    assert.strictEqual(reasonOf(await rejection(Keystore.toAccount(store, { id: key.id })))._tag, "CurveUnsupported")
  })

  it("rejects later signing with the store's error, such as a removed key", async () => {
    const store = Keystore.memory()
    const key = await Keystore.create(store, { curve: "secp256k1" })
    const account = await Keystore.toAccount(store, { id: key.id })
    await Keystore.remove(store, { id: key.id })

    assert.strictEqual(reasonOf(await rejection(account.signMessage({ message: "hello" })))._tag, "NotFound")
  })
})

describe("the Effect Keystore", () => {
  it("fails in the error channel with the same errors", async () => {
    const store = Effect_.Keystore.memory()
    const exit = await Effect.runPromiseExit(Effect_.Keystore.get(store, { id: "missing" }))

    assert.isTrue(Exit.isFailure(exit))
    const opened = await Effect.runPromiseExit(Effect_.Keystore.encryptedJson({ password, data: "{}" }))
    assert.isTrue(Exit.isFailure(opened))
  })
})
