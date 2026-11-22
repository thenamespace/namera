import { assert, describe, it } from "@effect/vitest"
import { Result } from "effect"

import { duplicateNames, exportsMap, moduleMetadata, parseBarrel, renderBarrel } from "@namera-ai/tools/sdk/barrels"

const moduleDoc = (tags: string) => `/**\n * A module.\n *\n${tags}\n */\nexport const a = 1\n`

describe("parseBarrel", () => {
  it("keeps everything up to the annotation and its trailing comment lines as the header", () => {
    const barrel = parseBarrel(
      "/**\n * @since 2.0.0\n */\n\n// @barrel: generated\n// keep me\n\nexport * as Old from \"./Old.ts\"\n"
    )

    assert.deepStrictEqual(barrel, {
      header: "/**\n * @since 2.0.0\n */\n\n// @barrel: generated\n// keep me",
      pattern: "*.ts"
    })
  })

  it("reads an explicit pattern", () => {
    assert.strictEqual(parseBarrel("// @barrel({*,accounts/*}.ts): generated\n")?.pattern, "{*,accounts/*}.ts")
  })

  it("ignores files without the annotation", () => {
    assert.isUndefined(parseBarrel("export * as A from \"./A.ts\"\n"))
  })
})

describe("moduleMetadata", () => {
  it("reads @since and @stability from the module TSDoc", () => {
    assert.deepStrictEqual(
      moduleMetadata(moduleDoc(" * @stability experimental\n * @since 2.0.0")),
      Result.succeed({ since: "2.0.0", stability: "experimental" })
    )
  })

  it("rejects a module without TSDoc or @since", () => {
    assert.deepStrictEqual(moduleMetadata("export const a = 1\n"), Result.fail("missing top-level module TSDoc"))
    assert.deepStrictEqual(moduleMetadata(moduleDoc(" * @stability stable")), Result.fail("missing module @since tag"))
  })
})

describe("renderBarrel", () => {
  it("exports every module by file name, sorted by path, with its stability and version", () => {
    const metadata = { since: "2.0.0", stability: "experimental" } as const

    assert.strictEqual(
      renderBarrel({ header: "// @barrel", pattern: "*.ts" }, [
        { path: "accounts/KernelAccount.ts", metadata },
        { path: "Grant.ts", metadata: { since: "2.1.0", stability: undefined } }
      ]),
      "// @barrel\n\n/**\n * @since 2.1.0\n */\nexport * as Grant from \"./Grant.ts\"\n\n"
        + "/**\n * @stability experimental\n * @since 2.0.0\n */\n"
        + "export * as KernelAccount from \"./accounts/KernelAccount.ts\"\n"
    )
  })

  it("leaves a barrel without modules as its header", () => {
    assert.strictEqual(renderBarrel({ header: "// @barrel", pattern: "*.ts" }, []), "// @barrel\n")
  })
})

describe("duplicateNames", () => {
  it("finds two modules a flattened barrel would export under one name", () => {
    const metadata = { since: "2.0.0", stability: undefined }
    assert.deepStrictEqual(
      duplicateNames([
        { path: "Signer.ts", metadata },
        { path: "keys/Signer.ts", metadata },
        { path: "Grant.ts", metadata }
      ]),
      ["Signer"]
    )
  })
})

describe("exportsMap", () => {
  it("has Effect's shape: folder entries, a wildcard, and null internals and index paths", () => {
    assert.deepStrictEqual(
      exportsMap(["testing", "effect"], ["internal", "testing/internal"], (path) => `./src/${path}.ts`),
      {
        "./package.json": "./package.json",
        ".": "./src/index.ts",
        "./effect": "./src/effect/index.ts",
        "./testing": "./src/testing/index.ts",
        "./*": "./src/*.ts",
        "./internal/*": null,
        "./testing/internal/*": null,
        "./index": null,
        "./*/index": null
      }
    )
  })
})
