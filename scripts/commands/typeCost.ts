import { Console, Effect, FileSystem, Formatter, Path, Schema } from "effect"
import { Command, Flag } from "effect/cli"

import { CheckFailed, SetupError } from "../errors.ts"
import { publishablePackages } from "../publishable.ts"
import { Tools } from "../services/Tools.ts"

/** How far the instantiation count may grow over the baseline before the check fails. */
export const tolerance = 1.2

/**
 * A package's `typeperf/baseline.json`: instantiation counts per consumer file.
 *
 * - `consumers`: budgeted by their own count.
 * - `apps`: realistic apps that use viem, budgeted by their count over `viem`, a viem-only twin, so the SDK's share is
 *   what is checked and a viem upgrade moves none of them.
 */
const Baseline = Schema.Struct({
  consumers: Schema.Record(Schema.String, Schema.Number),
  apps: Schema.optionalKey(
    Schema.Struct({ viem: Schema.String, baselines: Schema.Record(Schema.String, Schema.Number) })
  )
})
type Baseline = typeof Baseline.Type

const BaselineJson = Schema.fromJsonString(Baseline)

/** The instantiation count from `tsc --extendedDiagnostics` output, if it reports one. */
export const parseInstantiations = (output: string): number | undefined => {
  const match = /^Instantiations:\s+(\d+)$/m.exec(output)
  return match === null ? undefined : Number(match[1])
}

/** Whether `instantiations` is within the tolerance of the recorded baseline. */
export const withinBudget = (instantiations: number, baseline: number) => instantiations <= baseline * tolerance

/** One consumer's count against its baseline: the report line, and whether it is over. */
export interface Measurement {
  readonly line: string
  readonly over: boolean
}

/** A consumer's count against its baseline. */
export const consumerMeasurement = (name: string, instantiations: number, baseline: number): Measurement => ({
  line: `${name}: ${instantiations} instantiations (baseline ${baseline})`,
  over: !withinBudget(instantiations, baseline)
})

/** What an app costs over its viem-only twin. */
export const appShare = (counts: { readonly app: number; readonly viem: number }) => counts.app - counts.viem

/** An app's count over its viem-only twin's, against its baseline; the app's own count is only reported. */
export const appMeasurement = (
  name: string,
  counts: { readonly app: number; readonly viem: number },
  baseline: number
): Measurement => {
  const share = appShare(counts)
  return {
    line: `${name}: ${counts.app} instantiations, ${share} over viem (baseline ${baseline})`,
    over: !withinBudget(share, baseline)
  }
}

/** The baseline that records `counts`, every file's count by name, in the shape of `current`. */
export const updatedBaseline = (current: Baseline, counts: ReadonlyMap<string, number>): Baseline => {
  const count = (name: string) => counts.get(name) ?? 0
  const consumers = Object.fromEntries(Object.keys(current.consumers).map((name) => [name, count(name)]))
  if (current.apps === undefined) return { consumers }
  const { viem } = current.apps
  const baselines = Object.fromEntries(
    Object.keys(current.apps.baselines).map((name) => [name, appShare({ app: count(name), viem: count(viem) })])
  )
  return { consumers, apps: { viem, baselines } }
}

/**
 * Compiles each package's `typeperf/` consumers against the built declarations, one at a time, and fails when one's
 * instantiations (an app's: its share over viem) grow more than 20% over the recorded baseline. `--update` records the
 * current numbers.
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
      const baseline = yield* fs.readFileString(baselineFile).pipe(
        Effect.flatMap(Schema.decodeUnknownEffect(BaselineJson))
      )
      const names = [
        ...Object.keys(baseline.consumers),
        ...(baseline.apps === undefined ? [] : [baseline.apps.viem, ...Object.keys(baseline.apps.baselines)])
      ]

      // Each consumer is its own program, so one's types never warm the checker for another.
      const configs = yield* fs.makeTempDirectoryScoped({ prefix: "type-cost-" })
      const counts = new Map(
        yield* Effect.forEach(names, (name) =>
          Effect.gen(function*() {
            const config = path.join(configs, `${name}.json`)
            yield* fs.writeFileString(
              config,
              JSON.stringify({ extends: project, files: [path.join(pkg.dir, "typeperf", name)] })
            )
            const output = yield* tools.run("pnpm", ["exec", "tsc", "-p", config, "--extendedDiagnostics"], {
              cwd: root
            })
            const instantiations = parseInstantiations(output)
            if (instantiations === undefined) {
              return yield* SetupError.make({ message: `${pkg.name} ${name}: tsc reported no instantiation count` })
            }
            return [name, instantiations] as const
          }), { concurrency: 4 })
      )

      if (update) {
        const next = updatedBaseline(baseline, counts)
        yield* fs.writeFileString(baselineFile, `${Formatter.formatJson(next, { space: 2 })}\n`)
        yield* Console.log(`type-cost: ${pkg.name} baseline is ${Formatter.formatJson(next)}`)
        continue
      }

      const report = (measurement: Measurement) => {
        const line = `${pkg.name} ${measurement.line}`
        if (measurement.over) failures.push(line)
        return Console.log(`type-cost: ${line}`)
      }
      const count = (name: string) => counts.get(name) ?? 0
      for (const [name, instantiations] of Object.entries(baseline.consumers)) {
        yield* report(consumerMeasurement(name, count(name), instantiations))
      }
      if (baseline.apps === undefined) continue
      const viem = count(baseline.apps.viem)
      yield* Console.log(`type-cost: ${pkg.name} ${baseline.apps.viem}: ${viem} instantiations (viem only)`)
      for (const [name, instantiations] of Object.entries(baseline.apps.baselines)) {
        yield* report(appMeasurement(name, { app: count(name), viem }, instantiations))
      }
    }

    if (failures.length > 0) {
      return yield* CheckFailed.make({
        check: "type-cost",
        problems: [...failures, "more than 20% over the baseline; fix the types or run `pnpm type-cost --update`"]
      })
    }
  },
  Effect.scoped,
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
