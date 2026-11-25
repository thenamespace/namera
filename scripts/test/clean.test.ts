import { NodeServices } from "@effect/platform-node"
import { assert, describe, it } from "@effect/vitest"
import { Effect, FileSystem, Path } from "effect"

import { cleanWorkspace } from "../commands/clean.ts"

describe("cleanWorkspace", () => {
  it.effect("removes build output from the root, packages and apps, and keeps source", () =>
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "clean-" })
      const created = ["tmp/a", "packages/core/dist/index.js", "packages/core/src/index.ts", "apps/web/.data/x.json"]
      for (const file of created) {
        yield* fs.makeDirectory(path.dirname(path.join(root, file)), { recursive: true })
        yield* fs.writeFileString(path.join(root, file), "")
      }
      yield* fs.writeFileString(path.join(root, "tsconfig.tests.tsbuildinfo"), "")

      yield* cleanWorkspace(root)

      const exists = (file: string) => fs.exists(path.join(root, file))
      assert.isFalse(yield* exists("tmp"))
      assert.isFalse(yield* exists("packages/core/dist"))
      assert.isFalse(yield* exists("apps/web/.data"))
      assert.isFalse(yield* exists("tsconfig.tests.tsbuildinfo"))
      assert.isTrue(yield* exists("packages/core/src/index.ts"))
    }).pipe(Effect.provide(NodeServices.layer)))
})
