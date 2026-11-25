import { NodeServices } from "@effect/platform-node"
import { assert, describe, it } from "@effect/vitest"
import { Effect, FileSystem, Path } from "effect"

import { findCycles } from "../commands/circular.ts"

const writeModules = Effect.fn(function*(modules: Record<string, string>) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const dir = yield* fs.makeTempDirectoryScoped({ prefix: "circular-" })
  for (const [name, source] of Object.entries(modules)) yield* fs.writeFileString(path.join(dir, name), source)
  return Object.keys(modules).map((name) => path.join(dir, name))
})

describe("findCycles", () => {
  it.effect("reports modules that import each other", () =>
    Effect.gen(function*() {
      const files = yield* writeModules({
        "a.ts": `import { b } from "./b.ts"\nexport const a = () => b\n`,
        "b.ts": `import { a } from "./a.ts"\nexport const b = () => a\n`
      })
      assert.deepStrictEqual(yield* findCycles(files), ["a.ts -> b.ts"])
    }).pipe(Effect.provide(NodeServices.layer)))

  it.effect("ignores type-only imports", () =>
    Effect.gen(function*() {
      const files = yield* writeModules({
        "a.ts": `import type { B } from "./b.ts"\nexport type A = { readonly b: B }\n`,
        "b.ts": `import { type A } from "./a.ts"\nexport type B = { readonly a?: A }\n`
      })
      assert.deepStrictEqual(yield* findCycles(files), [])
    }).pipe(Effect.provide(NodeServices.layer)))

  it.effect("passes when there are no modules", () =>
    Effect.gen(function*() {
      assert.deepStrictEqual(yield* findCycles([]), [])
    }))
})
