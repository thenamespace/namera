import { execFileSync } from "node:child_process"
import * as Fs from "node:fs"
import * as Path from "node:path"
import { publishablePackages, root } from "./packages.ts"

// Compiles each package's `typeperf/` consumer against the built declarations and fails when the type checker's
// instantiations grow more than 20% over the recorded baseline. `--update` records the current numbers.
const update = process.argv.includes("--update")
const tolerance = 1.2
const failures: Array<string> = []

for (const { dir, manifest } of publishablePackages()) {
  const project = Path.join(dir, "typeperf", "tsconfig.json")
  if (!Fs.existsSync(project)) continue
  const baselineFile = Path.join(dir, "typeperf", "baseline.json")

  const output = execFileSync("pnpm", ["exec", "tsc", "-p", project, "--extendedDiagnostics"], {
    cwd: root,
    encoding: "utf8"
  })
  const instantiations = Number(/^Instantiations:\s+(\d+)$/m.exec(output)?.[1])
  if (!Number.isInteger(instantiations)) throw new Error(`${manifest.name}: tsc reported no instantiation count`)

  if (update) {
    Fs.writeFileSync(baselineFile, `${JSON.stringify({ instantiations }, null, 2)}\n`)
    console.log(`type-cost: ${manifest.name} baseline is ${instantiations} instantiations`)
    continue
  }
  const baseline: { readonly instantiations: number } = JSON.parse(Fs.readFileSync(baselineFile, "utf8"))
  const line = `${manifest.name}: ${instantiations} instantiations (baseline ${baseline.instantiations})`
  console.log(`type-cost: ${line}`)
  if (instantiations > baseline.instantiations * tolerance) failures.push(line)
}

if (failures.length > 0) {
  console.error(
    `type-cost: more than 20% over the baseline; fix the types or run \`pnpm type-cost --update\`\n${
      failures.join("\n")
    }`
  )
  process.exit(1)
}
