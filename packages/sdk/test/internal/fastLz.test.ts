import { assert, describe, it } from "@effect/vitest"
import * as FastLz from "@namera-ai/sdk/internal/core/grant/fastLz"
import * as fs from "node:fs"
import * as Hex from "ox/Hex"

// Solady's own JavaScript library, the reference the port must match byte for byte: Smart Sessions decompresses with
// Solady's `LibZip`. It is a CommonJS/UMD script, which the workspace's ESM packages can't `require`.
const solady = { exports: {} as { readonly LibZip: { readonly flzCompress: (data: string) => string } } }
new Function(
  "module",
  "exports",
  fs.readFileSync(
    new URL("../../../../contracts/dependencies/solady-0.1.26/js/solady.js", import.meta.url),
    "utf8"
  )
)(solady, solady.exports)
const { LibZip } = solady.exports

// Deterministic pseudo-random bytes, with runs, so both literals and matches occur.
const sample = (length: number, seed: number): Hex.Hex => {
  const bytes = new Uint8Array(length)
  let state = seed
  for (let i = 0; i < length; i++) {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    bytes[i] = state % 7 === 0 ? 0 : (state >> 16) & (state % 3 === 0 ? 0x0f : 0xff)
  }
  return Hex.fromBytes(bytes)
}

describe("FastLZ", () => {
  const inputs: ReadonlyArray<Hex.Hex> = [
    "0x",
    "0x01",
    "0x0102030405",
    Hex.fromBytes(new Uint8Array(1000)),
    Hex.concat(...Array.from({ length: 40 }, () => "0xdeadbeefcafe" as Hex.Hex)),
    ...[33, 100, 263, 1024, 5000, 20000].map((length, seed) => sample(length, seed + 1))
  ]

  for (const input of inputs) {
    it(`compresses ${Hex.size(input)} bytes as Solady does, and back`, () => {
      const compressed = FastLz.compress(input)
      assert.strictEqual(compressed, LibZip.flzCompress(input))
      assert.strictEqual(FastLz.decompress(compressed), input)
    })
  }
})
