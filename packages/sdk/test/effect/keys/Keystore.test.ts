import { assert, describe, it } from "@effect/vitest"
import { Keystore } from "@namera-ai/sdk/effect"
import { Effect, Layer } from "effect"

import { oxV1Export } from "../../keys/encryptedJson.fixture.ts"

const password = "correct horse battery staple"

const keyIds = Effect.gen(function*() {
  const store = yield* Keystore.CurrentKeystore
  return (yield* Keystore.list(store)).map(({ id }) => id)
})

describe("Keystore.CurrentKeystore", () => {
  it.effect("is the store a layer provides", () =>
    Effect.gen(function*() {
      const store = Keystore.memory()
      const key = yield* Keystore.create(store, { curve: "p256" })

      assert.deepStrictEqual(yield* keyIds.pipe(Effect.provide(Keystore.layer(store))), [key.id])
    }))

  it.effect("is a new memory store each time layerMemory is built", () =>
    Effect.gen(function*() {
      const created = Effect.gen(function*() {
        const store = yield* Keystore.CurrentKeystore
        yield* Keystore.create(store, { curve: "secp256k1" })
        return (yield* keyIds).length
      })

      assert.strictEqual(yield* created.pipe(Effect.provide(Keystore.layerMemory)), 1)
      assert.strictEqual(yield* created.pipe(Effect.provide(Keystore.layerMemory)), 1)
    }))

  it.effect("opens an encryptedJson export from layerEncryptedJson", () =>
    Effect.gen(function*() {
      const ids = yield* keyIds.pipe(Effect.provide(Keystore.layerEncryptedJson({ password, data: oxV1Export })))

      assert.strictEqual(ids.length, 3)
    }))

  it.effect("fails building layerEncryptedJson with Unavailable for data that is not an export", () =>
    Effect.gen(function*() {
      const error = yield* Layer.build(Keystore.layerEncryptedJson({ password, data: "{}" })).pipe(
        Effect.scoped,
        Effect.flip
      )

      assert.strictEqual(error.reason._tag, "Unavailable")
    }))
})
