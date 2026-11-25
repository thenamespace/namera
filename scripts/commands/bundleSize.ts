// oxlint-disable-next-line effecttsgo/node-builtin-import -- rollup's load hook is synchronous
import * as NodeFs from "node:fs"
// oxlint-disable-next-line effecttsgo/node-builtin-import -- used inside rollup's synchronous load hook
import * as NodePath from "node:path"
// oxlint-disable-next-line effecttsgo/node-builtin-import -- synchronous gzip of an in-memory bundle
import { gzipSync } from "node:zlib"

import { nodeResolve } from "@rollup/plugin-node-resolve"
import { Console, Effect, FileSystem, Path, Schema } from "effect"
import { Command } from "effect/cli"
import { build } from "esbuild"
import { type Plugin, rollup } from "rollup"
import esbuild from "rollup-plugin-esbuild"

import { CheckFailed, SetupError, ToolFailed } from "../errors.ts"
import { publishablePackages } from "../publishable.ts"

// The OS keychain store imports `@napi-rs/keyring`, an optional native peer, at run time; Node resolves it, never a
// bundler.
const runtimeOnly = ["@napi-rs/keyring", /^node:/]
const external = ["viem", /^viem\//, ...runtimeOnly]

/**
 * A package's `bundle/budgets.json`: gzip budgets in bytes.
 *
 * - `fixtures`: bundled with viem external, by rollup and by esbuild, each with its own budget.
 * - `apps`: bundled with viem for a browser. Each is budgeted by its size over `viem`, a viem-only app, so a viem
 *   upgrade moves none of them.
 */
const Budgets = Schema.fromJsonString(Schema.Struct({
  fixtures: Schema.Record(Schema.String, Schema.Struct({ rollup: Schema.Number, esbuild: Schema.Number })),
  apps: Schema.optionalKey(Schema.Struct({ viem: Schema.String, budgets: Schema.Record(Schema.String, Schema.Number) }))
}))

/** Whether a manifest's `sideEffects` declares every module free of side effects (`false` or `[]`). */
export const declaresNoSideEffects = (sideEffects: unknown) =>
  sideEffects === false || (Array.isArray(sideEffects) && sideEffects.length === 0)

// Consumers' bundlers read `sideEffects` from the package.json nearest to every file, but node-resolve only applies
// it to files it resolves through a package entry, so a workspace package's own modules would count as side-effectful.
const packageSideEffects = (): Plugin => {
  const cache = new Map<string, boolean>()
  const sideEffectFree = (dir: string): boolean => {
    const cached = cache.get(dir)
    if (cached !== undefined) return cached
    const manifest = NodePath.join(dir, "package.json")
    const parent = NodePath.dirname(dir)
    const result = NodeFs.existsSync(manifest)
      ? declaresNoSideEffects(JSON.parse(NodeFs.readFileSync(manifest, "utf8")).sideEffects)
      : parent !== dir && sideEffectFree(parent)
    cache.set(dir, result)
    return result
  }
  return {
    name: "package-side-effects",
    load: (id) =>
      id.startsWith("\0") || !sideEffectFree(NodePath.dirname(id))
        ? null
        : { code: NodeFs.readFileSync(id, "utf8"), moduleSideEffects: false }
  }
}

// rollup-plugin-esbuild without its resolveId, so node-resolve alone resolves every import: with it, rollup kept or
// dropped Effect's core modules from run to run (Compat: 21 or 25 KB gzip).
const minify = (): Plugin => {
  const { resolveId: _resolveId, ...plugin } = esbuild({ target: "es2022", minify: true })
  return plugin
}

const gzipped = (code: string) => gzipSync(code, { level: 9 }).length

/** The minified, gzipped size of `input` bundled by rollup, with viem external or, for an app, bundled for a browser. */
const rollupSize = (input: string, options: { readonly app: boolean }) =>
  Effect.tryPromise({
    try: async () => {
      const bundle = await rollup({
        input,
        external: options.app ? runtimeOnly : external,
        treeshake: { preset: "recommended" },
        plugins: [
          packageSideEffects(),
          nodeResolve(
            options.app
              ? { browser: true, exportConditions: ["browser", "import", "default"] }
              : { exportConditions: ["import", "default"] }
          ),
          minify()
        ],
        onwarn: (warning) => {
          // Cycles and misplaced `@__PURE__` comments inside dependencies (ox, Effect, @scure, viem) are theirs to
          // keep; the same warning in our own code still fails.
          const thirdParty = (warning.code === "CIRCULAR_DEPENDENCY" &&
            (warning.ids ?? []).every((id) => id.includes("/node_modules/")))
            || (warning.code === "INVALID_ANNOTATION" && (warning.id ?? "").includes("/node_modules/"))
          if (!thirdParty) throw new Error(warning.message)
        }
      })
      const { output } = await bundle.generate({ format: "esm" })
      await bundle.close()
      return gzipped(output.map((chunk) => chunk.type === "chunk" ? chunk.code : "").join(""))
    },
    catch: (cause) => ToolFailed.make({ tool: `rollup ${input}`, output: String(cause) })
  })

// esbuild users (tsup, Bun, esbuild itself) get no property-level tree shaking of object literals, so their bundles
// differ from rollup's; the same conditions as the rollup pass keep the two comparable.
const esbuildSize = (input: string) =>
  Effect.tryPromise({
    try: async () => {
      const result = await build({
        entryPoints: [input],
        bundle: true,
        minify: true,
        format: "esm",
        target: "es2022",
        platform: "neutral",
        mainFields: ["module", "main"],
        external: ["viem", "viem/*", "@napi-rs/keyring", "node:*"],
        write: false,
        logLevel: "silent"
      })
      return gzipped(result.outputFiles.map((file) => file.text).join(""))
    },
    catch: (cause) => ToolFailed.make({ tool: `esbuild ${input}`, output: String(cause) })
  })

const kilobytes = (bytes: number) => `${(bytes / 1024).toFixed(2)} KB`

/** One measured bundle against its budget: the report line, and whether it is over. */
export interface Measurement {
  readonly line: string
  readonly over: boolean
}

/** A fixture's gzip size against its budget. */
export const fixtureMeasurement = (name: string, size: number, budget: number): Measurement => ({
  line: `${name}: ${kilobytes(size)} gzip (budget ${kilobytes(budget)})`,
  over: size > budget
})

/** An app's gzip size over the viem-only app's, against its budget; the app's own size is only reported. */
export const appMeasurement = (
  name: string,
  sizes: { readonly app: number; readonly viem: number },
  budget: number
): Measurement => {
  const share = sizes.app - sizes.viem
  return {
    line: `${name}: ${kilobytes(sizes.app)} gzip, ${kilobytes(share)} over viem (budget ${kilobytes(budget)})`,
    over: share > budget
  }
}

/** Bundles each fixture and app in a package's `bundle/budgets.json` and fails when one exceeds its gzip budget. */
const run = Effect.fn("bundleSize")(
  function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const failures: Array<string> = []
    const report = (pkg: string, measurement: Measurement) => {
      const line = `${pkg} ${measurement.line}`
      if (measurement.over) failures.push(line)
      return Console.log(line)
    }

    for (const pkg of yield* publishablePackages(process.cwd())) {
      const budgetsFile = path.join(pkg.dir, "bundle", "budgets.json")
      if (!(yield* fs.exists(budgetsFile))) continue
      const budgets = yield* fs.readFileString(budgetsFile).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Budgets)))
      const fixture = (name: string) => path.join(pkg.dir, "bundle", name)

      for (const [name, budget] of Object.entries(budgets.fixtures)) {
        const [rollupBytes, esbuildBytes] = yield* Effect.all([
          rollupSize(fixture(name), { app: false }),
          esbuildSize(fixture(name))
        ], { concurrency: 2 })
        yield* report(pkg.name, fixtureMeasurement(`${name} rollup`, rollupBytes, budget.rollup))
        yield* report(pkg.name, fixtureMeasurement(`${name} esbuild`, esbuildBytes, budget.esbuild))
      }

      if (budgets.apps === undefined) continue
      const viem = yield* rollupSize(fixture(budgets.apps.viem), { app: true })
      yield* Console.log(`${pkg.name} ${budgets.apps.viem}: ${kilobytes(viem)} gzip (viem only)`)
      for (const [name, budget] of Object.entries(budgets.apps.budgets)) {
        const app = yield* rollupSize(fixture(name), { app: true })
        yield* report(pkg.name, appMeasurement(name, { app, viem }, budget))
      }
    }

    if (failures.length > 0) return yield* CheckFailed.make({ check: "bundle-size", problems: failures })
  },
  Effect.catchTags({
    PlatformError: (cause) => SetupError.make({ message: String(cause) }),
    SchemaError: (cause) => SetupError.make({ message: String(cause) })
  })
)

export const bundleSize = Command.make("bundle-size").pipe(
  Command.withDescription("Fail when a package's bundle fixtures exceed their gzip budgets"),
  Command.withHandler(() => run())
)
