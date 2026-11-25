import { Console, Effect, FileSystem, Path, Schema } from "effect"
import { Command } from "effect/cli"
import { globSync } from "glob"

import { SetupError } from "../errors.ts"
import { Tools } from "../services/Tools.ts"

const Manifest = Schema.fromJsonString(
  Schema.Struct({ name: Schema.String, private: Schema.optionalKey(Schema.Boolean) })
)
const Packed = Schema.fromJsonString(Schema.Struct({ filename: Schema.String }))

/**
 * Packs every publishable package as npm would (publishConfig applied) and checks each tarball with
 * publint and attw. Run after `pnpm build`; the release runs the fuller `release check`.
 */
const run = Effect.fn("packCheck")(
  function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const tools = yield* Tools
    const out = yield* fs.makeTempDirectoryScoped({ prefix: "pack-check-" })

    for (const manifestFile of globSync("packages/*/package.json", { absolute: true }).sort()) {
      const manifest = yield* fs.readFileString(manifestFile).pipe(
        Effect.flatMap(Schema.decodeUnknownEffect(Manifest))
      )
      if (manifest.private === true) continue

      const packed = yield* tools.run("pnpm", ["pack", "--json", "--pack-destination", out], {
        cwd: path.dirname(manifestFile)
      }).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Packed)))
      yield* tools.run("pnpm", ["exec", "publint", "run", packed.filename, "--strict"])
      yield* tools.run("pnpm", ["exec", "attw", packed.filename, "--profile", "esm-only", "--format", "ascii"])
      yield* Console.log(`ok    ${manifest.name}`)
    }
    yield* Console.log("pack-check: ok")
  },
  Effect.scoped,
  Effect.catchTags({
    PlatformError: (cause) => SetupError.make({ message: String(cause) }),
    SchemaError: (cause) => SetupError.make({ message: String(cause) })
  })
)

export const packCheck = Command.make("pack-check").pipe(
  Command.withDescription("Pack each publishable package and check it with publint and attw"),
  Command.withHandler(() => run())
)
