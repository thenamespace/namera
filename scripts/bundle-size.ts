import { nodeResolve } from "@rollup/plugin-node-resolve"
import * as Fs from "node:fs"
import * as Path from "node:path"
import * as Zlib from "node:zlib"
import { rollup } from "rollup"
import esbuild from "rollup-plugin-esbuild"
import { publishablePackages } from "./packages.ts"

const external = ["viem", /^viem\//]
const failures: Array<string> = []

for (const { dir, manifest } of publishablePackages()) {
  const budgetsFile = Path.join(dir, "bundle", "budgets.json")
  if (!Fs.existsSync(budgetsFile)) continue
  const budgets: Record<string, number> = JSON.parse(Fs.readFileSync(budgetsFile, "utf8"))

  for (const [fixture, budget] of Object.entries(budgets)) {
    const bundle = await rollup({
      input: Path.join(dir, "bundle", fixture),
      external,
      treeshake: { moduleSideEffects: false },
      plugins: [nodeResolve({ exportConditions: ["import", "default"] }), esbuild({ target: "es2022", minify: true })],
      onwarn: (warning) => {
        throw new Error(`${fixture}: ${warning.message}`)
      }
    })
    const { output } = await bundle.generate({ format: "esm" })
    await bundle.close()
    const code = output.map((chunk) => chunk.type === "chunk" ? chunk.code : "").join("")
    const gzip = Zlib.gzipSync(code, { level: 9 }).length
    const line = `${manifest.name} ${fixture}: ${(gzip / 1024).toFixed(2)} KB gzip (budget ${
      (budget / 1024).toFixed(2)
    } KB)`
    console.log(line)
    if (gzip > budget) failures.push(line)
  }
}

if (failures.length > 0) {
  console.error(`bundle-size: over budget\n${failures.join("\n")}`)
  process.exit(1)
}
