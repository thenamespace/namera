import { assert, describe, it } from "@effect/vitest"
import { binNames, entriesModule, publicEntries } from "../../release/consumer.ts"

describe("publicEntries", () => {
  it("keeps exact JavaScript subpaths and drops package.json and other files", () => {
    assert.deepStrictEqual(
      publicEntries("@scope/lint", {
        "./package.json": "./package.json",
        "./oxlint": "./dist/oxlint/index.js",
        "./oxlintrc.json": "./oxlintrc.json"
      }, []),
      ["@scope/lint/oxlint"]
    )
  })

  it("expands pattern exports to the files their target matches", () => {
    assert.deepStrictEqual(
      publicEntries("@scope/tool", {
        ".": "./dist/Main.js",
        "./*": "./dist/*.js"
      }, ["dist/Main.js", "dist/Glob.js", "dist/Glob.js.map", "dist/Glob.d.ts", "src/Glob.ts"]),
      ["@scope/tool", "@scope/tool/Main", "@scope/tool/Glob"]
    )
  })

  it("drops subpaths an export maps to null, exactly or by pattern", () => {
    assert.deepStrictEqual(
      publicEntries("tool", {
        "./*": "./dist/*.js",
        "./bin": null,
        "./commands/*": null
      }, ["dist/Codegen.js", "dist/bin.js", "dist/commands/codegen.js"]),
      ["tool/Codegen"]
    )
  })
})

describe("binNames", () => {
  it("reads bin maps and names a string bin after the unscoped package", () => {
    assert.deepStrictEqual(binNames("@scope/tool", { "tool-a": "./a.js", "tool-b": "./b.js" }), ["tool-a", "tool-b"])
    assert.deepStrictEqual(binNames("@scope/tool", "./bin.js"), ["tool"])
    assert.deepStrictEqual(binNames("@scope/tool", undefined), [])
  })
})

describe("entriesModule", () => {
  it("imports every entry", () => {
    const module = entriesModule(["pkg/Main", "pkg/Glob"])
    assert.include(module, `import * as entry0 from "pkg/Main";`)
    assert.include(module, `import * as entry1 from "pkg/Glob";`)
  })
})
