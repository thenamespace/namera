import { NodeServices } from "@effect/platform-node"
import { assert, describe, it } from "@effect/vitest"
import { Effect, FileSystem, Path } from "effect"

import { javaScriptScripts } from "../commands/lint.ts"

describe("javaScriptScripts", () => {
  it.effect("finds JavaScript files under scripts/, outside node_modules", () =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "lint-" })
      for (
        const file of [
          "scripts/bin.ts",
          "scripts/old.mjs",
          "scripts/commands/x.js",
          "scripts/node_modules/dep/index.js"
        ]
      ) {
        yield* fs.makeDirectory(path.dirname(path.join(root, file)), { recursive: true })
        yield* fs.writeFileString(path.join(root, file), "")
      }

      assert.deepStrictEqual(javaScriptScripts(root), ["scripts/commands/x.js", "scripts/old.mjs"])
    }).pipe(Effect.provide(NodeServices.layer)))
})
