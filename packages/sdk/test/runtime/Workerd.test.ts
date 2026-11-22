import { assert, describe, it } from "@effect/vitest"
import * as esbuild from "esbuild"
import { Miniflare } from "miniflare"
import * as Path from "node:path"

import { expected } from "./smoke.test-utils.ts"

describe("the SDK on Cloudflare Workers (workerd)", () => {
  it("keeps its clock, errors, Schema encoding and Effect API working", async () => {
    const { outputFiles } = await esbuild.build({
      entryPoints: [Path.join(import.meta.dirname, "worker.ts")],
      bundle: true,
      format: "esm",
      platform: "neutral",
      conditions: ["workerd", "worker", "import", "default"],
      mainFields: ["module", "main"],
      write: false
    })
    const worker = new Miniflare({ modules: true, script: outputFiles[0]!.text, compatibilityDate: "2026-07-30" })
    try {
      const response = await worker.dispatchFetch("http://localhost/")
      assert.deepStrictEqual(await response.json(), expected)
    } finally {
      await worker.dispose()
    }
  })
})
