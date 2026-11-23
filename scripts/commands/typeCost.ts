import { Console, Effect, FileSystem, Formatter, Path, Schema } from "effect"
import { Command, Flag } from "effect/cli"

import { CheckFailed, SetupError } from "../errors.ts"
import { publishablePackages } from "../publishable.ts"
import { Tools } from "../services/Tools.ts"

/** How far the instantiation count may grow over the baseline before the check fails. */
export const tolerance = 1.2

const Baseline = Schema.fromJsonString(Schema.Struct({ instantiations: Schema.Number }))

/** The instantiation count from `tsc --extendedDiagnostics` output, if it reports one. */
export const parseInstantiations = (output: string): number | undefined => {
  const match = /^Instantiations:\s+(\d+)$/m.exec(output)
  return match === null ? undefined : Number(match[1])
}

/** Whether `instantiations` is within the tolerance of the recorded baseline. */
export const withinBudget = (instantiations: number, baseline: number) => instantiations <= baseline * tolerance

/**
 * Compiles each package's `typeperf/` consumer against the built declarations and fails when the
 * type checker's instantiations grow more than 20% over the recorded baseline. `--update` records
 * the current numbers.
 */
const run = Effect.fn("typeCost")(
  function*(update: boolean) {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const tools = yield* Tools
    const root = process.cwd()
    const failures: Array<string> = []

    for (const pkg of yield* publishablePackages(root)) {
      const project = path.join(pkg.dir, "typeperf", "tsconfig.json")
      if (!(yield* fs.exists(project))) continue
      const baselineFile = path.join(pkg.dir, "typeperf", "baseline.json")

      const output = yield* tools.run("pnpm", ["exec", "tsc", "-p", project, "--extendedDiagnostics"], { cwd: root })
      const instantiations = parseInstantiations(output)
      if (instantiations === undefined) {
        return yield* SetupError.make({ message: `${pkg.name}: tsc reported no instantiation count` })
      }

      if (update) {
        yield* fs.writeFileString(baselineFile, `${Formatter.formatJson({ instantiations }, { space: 2 })}\n`)
        yield* Console.log(`type-cost: ${pkg.name} baseline is ${instantiations} instantiations`)
        continue
      }
      const baseline = yield* fs.readFileString(baselineFile).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Baseline)))
      const line = `${pkg.name}: ${instantiations} instantiations (baseline ${baseline.instantiations})`
      yield* Console.log(`type-cost: ${line}`)
      if (!withinBudget(instantiations, baseline.instantiations)) failures.push(line)
    }

    if (failures.length > 0) {
      return yield* CheckFailed.make({
        check: "type-cost",
        problems: [...failures, "more than 20% over the baseline; fix the types or run `pnpm type-cost --update`"]
      })
    }
  },
  Effect.catchTags({
    PlatformError: (cause) => SetupError.make({ message: String(cause) }),
    SchemaError: (cause) => SetupError.make({ message: String(cause) })
  })
)

export const typeCost = Command.make("type-cost", {
  update: Flag.Boolean("update").pipe(
    Flag.withDefault(false),
    Flag.withDescription("Record the current instantiation counts as the baseline")
  )
}, ({ update }) => run(update)).pipe(
  Command.withDescription("Compare each package's type-check cost (`typeperf/`) with its baseline")
)
