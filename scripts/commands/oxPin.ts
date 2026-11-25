import { Console, Effect, FileSystem, Path, Schema } from "effect"
import { Command } from "effect/cli"

import { CheckFailed } from "../errors.ts"

const Manifest = Schema.fromJsonString(
  Schema.Struct({
    dependencies: Schema.optionalKey(Schema.Record(Schema.String, Schema.String))
  })
)

const oxOf = Effect.fn("oxPin.oxOf")(function*(manifestFile: string) {
  const fs = yield* FileSystem.FileSystem
  const manifest = yield* fs.readFileString(manifestFile).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Manifest)))
  return manifest.dependencies?.["ox"]
})

/**
 * The problems with the SDK's `ox` pin in `sdkDir`: it must be the exact version the installed viem depends on, so an
 * app resolves one ox (and one `@noble/*`) for both. viem pins ox exactly; any other version, or a range that npm
 * resolves elsewhere, bundles a second copy (19 to 34 KB gzip in an app).
 */
export const oxPinProblems = Effect.fn("oxPin.problems")(function*(sdkDir: string) {
  const path = yield* Path.Path
  const sdk = yield* oxOf(path.join(sdkDir, "package.json"))
  const viem = yield* oxOf(path.join(sdkDir, "node_modules", "viem", "package.json"))

  if (viem === undefined) return ["the installed viem declares no ox dependency"]
  if (sdk === viem) return []
  return [`@namera-ai/sdk depends on ox ${sdk ?? "(none)"}, viem on ox ${viem}: pin "ox": "${viem}"`]
})

const run = Effect.fn("oxPin")(function*() {
  const problems = yield* oxPinProblems("packages/sdk")
  if (problems.length > 0) return yield* CheckFailed.make({ check: "ox-pin", problems })
  yield* Console.log("ox-pin: ok")
})

export const oxPin = Command.make("ox-pin").pipe(
  Command.withDescription("Fail when the SDK's ox is not the exact version viem depends on"),
  Command.withHandler(() => run())
)
