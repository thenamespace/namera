import { afterAll, assert, describe, it } from "@effect/vitest"
import { Keystore } from "@namera-ai/sdk"
import { Keystore as NodeKeystore } from "@namera-ai/sdk/node"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { conformance, reasonOf, rejection } from "../keys/keystore.test-utils.ts"

const kdf = { type: "scrypt", n: 1024 } as const
const password = "correct horse battery staple"
const folders: Array<string> = []
const folder = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "namera-keys-"))
  folders.push(dir)
  return path.join(dir, "keys")
}

afterAll(() => {
  for (const dir of folders) fs.rmSync(dir, { recursive: true, force: true })
})

conformance("file", () => NodeKeystore.file({ path: folder(), password, kdf }), ["secp256k1", "ed25519", "p256"])

describe("Keystore.file", () => {
  it("keeps each key in its own encrypted file, readable by the owner only", async () => {
    const dir = folder()
    const store = NodeKeystore.file({ path: dir, password, kdf })
    const key = await Keystore.create(store, { curve: "secp256k1" })

    const file = path.join(dir, `${key.id}.json`)
    assert.strictEqual(fs.statSync(dir).mode & 0o777, 0o700)
    assert.strictEqual(fs.statSync(file).mode & 0o777, 0o600)
    const contents = fs.readFileSync(file, "utf8")
    assert.include(contents, "ciphertext")
    assert.notInclude(contents, password)
    assert.deepStrictEqual(fs.readdirSync(dir), [`${key.id}.json`])
  })

  it("opens the folder again with the password, and fails with Locked with another", async () => {
    const dir = folder()
    const key = await Keystore.create(NodeKeystore.file({ path: dir, password, kdf }), { curve: "secp256k1" })

    assert.deepStrictEqual(await Keystore.list(NodeKeystore.file({ path: dir, password, kdf })), [key])
    const locked = NodeKeystore.file({ path: dir, password: "wrong", kdf })
    const reason = reasonOf(await rejection(Keystore.sign(locked, { id: key.id, digest: `0x${"01".repeat(32)}` })))
    assert.strictEqual(reason._tag, "Locked")
  })

  it("treats ids that look like paths as unknown keys, and an empty folder as no keys", async () => {
    const store = NodeKeystore.file({ path: folder(), password, kdf })

    assert.deepStrictEqual(await Keystore.list(store), [])
    for (const id of ["../outside", "a/b", ".."]) {
      assert.strictEqual(reasonOf(await rejection(Keystore.get(store, { id })))._tag, "NotFound")
    }
  })
})

// The OS keychain is the real one of the machine running the tests, so this suite runs only when asked
// (NAMERA_KEYCHAIN_TESTS=1, set by the macOS CI job), with a unique service whose keys it removes afterwards.
const keychain = process.env["NAMERA_KEYCHAIN_TESTS"] === "1"
const service = `namera-sdk-test-${process.pid}-${Date.now()}`
describe.runIf(keychain)("Keystore.osKeychain", () => {
  afterAll(async () => {
    const store = NodeKeystore.osKeychain({ service })
    for (const key of await Keystore.list(store)) await Keystore.remove(store, { id: key.id })
  })

  conformance("osKeychain", () => NodeKeystore.osKeychain({ service }), ["secp256k1", "ed25519", "p256"])
})
