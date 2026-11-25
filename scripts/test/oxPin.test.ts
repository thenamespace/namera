import { NodeServices } from "@effect/platform-node"
import { assert, describe, it } from "@effect/vitest"
import { Effect, FileSystem, Path } from "effect"

import { oxPinProblems } from "../commands/oxPin.ts"

const writeSdk = Effect.fn(function*(sdkOx: string | undefined, viemOx: string | undefined) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const dir = yield* fs.makeTempDirectoryScoped({ prefix: "ox-pin-" })
  const viemDir = path.join(dir, "node_modules", "viem")
  yield* fs.makeDirectory(viemDir, { recursive: true })
  const manifest = (ox: string | undefined) => JSON.stringify(ox === undefined ? {} : { dependencies: { ox } })
  yield* fs.writeFileString(path.join(dir, "package.json"), manifest(sdkOx))
  yield* fs.writeFileString(path.join(viemDir, "package.json"), manifest(viemOx))
  return dir
})

describe("oxPinProblems", () => {
  it.effect("passes when the SDK pins the ox viem depends on", () =>
    Effect.gen(function*() {
      assert.deepStrictEqual(yield* oxPinProblems(yield* writeSdk("0.14.67", "0.14.67")), [])
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))

  it.effect("fails on another version or a range", () =>
    Effect.gen(function*() {
      for (const sdk of ["^1.8.19", "^0.14.67", "0.14.66"]) {
        const problems = yield* oxPinProblems(yield* writeSdk(sdk, "0.14.67"))
        assert.deepStrictEqual(problems, [
          `@namera-ai/sdk depends on ox ${sdk}, viem on ox 0.14.67: pin "ox": "0.14.67"`
        ])
      }
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))

  it.effect("fails when viem has no ox", () =>
    Effect.gen(function*() {
      assert.deepStrictEqual(yield* oxPinProblems(yield* writeSdk("0.14.67", undefined)), [
        "the installed viem declares no ox dependency"
      ])
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))
})
