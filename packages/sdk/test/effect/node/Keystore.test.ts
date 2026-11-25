import { afterAll, assert, describe, it } from "@effect/vitest"
import { Keystore } from "@namera-ai/sdk/effect"
import { Keystore as NodeKeystore } from "@namera-ai/sdk/effect/node"
import { Effect } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

const kdf = { type: "scrypt", n: 1024 } as const
const password = "correct horse battery staple"
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "namera-keys-"))

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

describe("Keystore.layerFile", () => {
  it.effect("provides a file store whose keys another store on the folder reads", () =>
    Effect.gen(function*() {
      const options = { path: path.join(dir, "keys"), password, kdf }
      const key = yield* Effect.gen(function*() {
        return yield* Keystore.create(yield* Keystore.CurrentKeystore, { curve: "secp256k1" })
      }).pipe(Effect.provide(NodeKeystore.layerFile(options)))

      assert.deepStrictEqual(yield* Keystore.list(NodeKeystore.file(options)), [key])
    }))
})
