import { assert, describe, it } from "@effect/vitest"

import { consumerManifests, publicEntries } from "@namera-ai/tools/release/consumer"

describe("publicEntries", () => {
  it("imports every named entry, skipping patterns and the paths the map blocks", () => {
    assert.deepStrictEqual(
      publicEntries("@namera-ai/sdk", {
        "./package.json": "./package.json",
        ".": "./dist/index.js",
        "./testing": "./dist/testing/index.js",
        "./*": "./dist/*.js",
        "./internal/*": null,
        "./index": null
      }),
      ["@namera-ai/sdk", "@namera-ai/sdk/testing"]
    )
  })
})

describe("consumerManifests", () => {
  it("installs without failing on dependencies' unapproved build scripts", () => {
    const { workspace } = consumerManifests([], () => "", { prool: "^0.3.0" })
    assert.include(workspace, "strictDepBuilds: false")
  })
})
