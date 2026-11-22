import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"

import { CheckFailed } from "../errors.ts"
import { Tools } from "../services/Tools.ts"

/**
 * Formats generated files with dprint in a staging directory, then writes the ones that differ, or with `check`
 * fails naming them. `outputs` maps absolute paths to their unformatted contents.
 */
export const writeFormatted = Effect.fnUntraced(function*(options: {
  readonly name: string
  readonly outputs: ReadonlyMap<string, string>
  readonly check: boolean
  readonly fix: string
}) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const tools = yield* Tools

  const staging = yield* fs.makeTempDirectoryScoped({ prefix: "namera-codegen-" })
  const staged = new Map<string, string>()
  for (const [file, content] of options.outputs) {
    const target = path.join(staging, path.relative(path.resolve("."), file))
    yield* fs.makeDirectory(path.dirname(target), { recursive: true })
    yield* fs.writeFileString(target, content)
    staged.set(file, target)
  }
  yield* tools.run("pnpm", ["exec", "dprint", "fmt", "--config", path.resolve("dprint.json"), ...staged.values()])

  const stale: Array<string> = []
  for (const [file, target] of staged) {
    const expected = yield* fs.readFileString(target)
    const actual = (yield* fs.exists(file)) ? yield* fs.readFileString(file) : undefined
    if (actual === expected) continue
    if (options.check) {
      stale.push(file)
      continue
    }
    yield* fs.makeDirectory(path.dirname(file), { recursive: true })
    yield* fs.writeFileString(file, expected)
  }

  if (stale.length > 0) {
    return yield* CheckFailed.make({ check: `${options.name} --check`, problems: [...stale, options.fix] })
  }
  return yield* Console.log(
    `${options.name}: ${options.check ? "up to date" : "wrote"} (${options.outputs.size} files)`
  )
}, Effect.scoped)
