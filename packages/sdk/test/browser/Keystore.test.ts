import { assert, describe, it } from "@effect/vitest"
import { Keystore } from "@namera-ai/sdk"
import { Keystore as BrowserKeystore } from "@namera-ai/sdk/browser"

import { conformance } from "../keys/keystore.test-utils.ts"

// Runs in Chromium (the `@namera-ai/sdk/browser` project, `NAMERA_RUNTIME_TESTS=1`). Each store gets its own database.
let databases = 0
conformance("webCrypto", () => BrowserKeystore.webCrypto({ database: `namera-test-${databases++}` }), ["p256"])

describe("Keystore.webCrypto", () => {
  it("signs the SHA-256 of the digest, as WebCrypto does, and says so", () => {
    assert.strictEqual(BrowserKeystore.webCrypto({ database: "namera-test-prehash" }).prehash, "sha256")
  })

  it("keeps keys across store instances on the same database", async () => {
    const key = await Keystore.create(BrowserKeystore.webCrypto({ database: "namera-test-reopen" }), { curve: "p256" })

    assert.deepStrictEqual(await Keystore.list(BrowserKeystore.webCrypto({ database: "namera-test-reopen" })), [key])
  })
})
