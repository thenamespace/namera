import { Console, Effect, FileSystem, Path } from "effect"
import { Command } from "effect/cli"

import { SetupError } from "../errors.ts"

/**
 * Turns `stripInternal` on in `tsconfig.base.json` for a publish build, as Effect's release does:
 * `@internal` declarations stay visible to the repository's tests but never ship.
 */
export const enableStripInternal = (tsconfig: string) => {
  const updated = tsconfig.replace("\"stripInternal\": false", "\"stripInternal\": true")
  return updated === tsconfig ? undefined : updated
}

const run = Effect.fn("stripInternal")(
  function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const file = path.resolve("tsconfig.base.json")
    const updated = enableStripInternal(yield* fs.readFileString(file))
    if (updated === undefined) {
      return yield* SetupError.make({ message: "tsconfig.base.json: no `\"stripInternal\": false` to enable" })
    }
    yield* fs.writeFileString(file, updated)
    yield* Console.log("strip-internal: enabled for this build")
  },
  Effect.catchTag("PlatformError", (cause) => SetupError.make({ message: String(cause) }))
)

export const stripInternal = Command.make("strip-internal").pipe(
  Command.withDescription("Enable `stripInternal` in tsconfig.base.json for a publish build (never commit it)"),
  Command.withHandler(() => run())
)
