import { NodeServices } from "@effect/platform-node"
import { assert, describe, it } from "@effect/vitest"
import { Effect, FileSystem, Path } from "effect"
import { spawnSync } from "node:child_process"

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

  // Runs the module with Node against an installed package whose modules are TypeScript's emit.
  const run = Effect.fn(function*(specifiers: ReadonlyArray<string>) {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const dir = yield* fs.makeTempDirectoryScoped({ prefix: "entries-" })
    const pkg = path.join(dir, "node_modules", "pkg")
    yield* fs.makeDirectory(pkg, { recursive: true })
    yield* fs.writeFileString(
      path.join(pkg, "package.json"),
      JSON.stringify({ type: "module", exports: { "./*": "./*.js" } })
    )
    yield* fs.writeFileString(path.join(pkg, "Main.js"), "export const main = 1;\n")
    yield* fs.writeFileString(path.join(pkg, "Types.js"), "export {};\n//# sourceMappingURL=Types.js.map")
    yield* fs.writeFileString(path.join(pkg, "Empty.js"), "const unused = 1;\n")
    yield* fs.writeFileString(path.join(dir, "entries.mjs"), entriesModule(specifiers))
    return spawnSync(process.execPath, ["entries.mjs"], { cwd: dir, encoding: "utf8" })
  })

  it.effect("accepts an entry of types only and refuses any other entry without exports", () =>
    Effect.gen(function*() {
      assert.strictEqual((yield* run(["pkg/Main", "pkg/Types"])).status, 0)

      const empty = yield* run(["pkg/Main", "pkg/Empty"])
      assert.notStrictEqual(empty.status, 0)
      assert.include(empty.stderr, "no exports: pkg/Empty")
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))
})
