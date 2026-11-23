// oxlint-disable-next-line effecttsgo/node-builtin-import -- rollup's load hook is synchronous
import * as NodeFs from "node:fs"
// oxlint-disable-next-line effecttsgo/node-builtin-import -- used inside rollup's synchronous load hook
import * as NodePath from "node:path"
// oxlint-disable-next-line effecttsgo/node-builtin-import -- synchronous gzip of an in-memory bundle
import { gzipSync } from "node:zlib"

import { nodeResolve } from "@rollup/plugin-node-resolve"
import { Console, Effect, FileSystem, Path, Schema } from "effect"
import { Command } from "effect/cli"
import { type Plugin, rollup } from "rollup"
import esbuild from "rollup-plugin-esbuild"

import { CheckFailed, SetupError, ToolFailed } from "../errors.ts"
import { publishablePackages } from "../publishable.ts"

const external = ["viem", /^viem\//]

const Budgets = Schema.fromJsonString(Schema.Record(Schema.String, Schema.Number))

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

/** The minified, gzipped size of `input` bundled for a browser, with viem external. */
const gzippedSize = (input: string) =>
  Effect.tryPromise({
    try: async () => {
      const bundle = await rollup({
        input,
        external,
        treeshake: { preset: "recommended" },
        plugins: [
          packageSideEffects(),
          nodeResolve({ exportConditions: ["import", "default"] }),
          esbuild({ target: "es2022", minify: true })
        ],
        onwarn: (warning) => {
          // Cycles inside dependencies (ox, Effect) are theirs to keep; a cycle through our own code still fails.
          const thirdParty = warning.code === "CIRCULAR_DEPENDENCY" &&
            (warning.ids ?? []).every((id) => id.includes("/node_modules/"))
          if (!thirdParty) throw new Error(warning.message)
        }
      })
      const { output } = await bundle.generate({ format: "esm" })
      await bundle.close()
      return gzipSync(output.map((chunk) => chunk.type === "chunk" ? chunk.code : "").join(""), { level: 9 }).length
    },
    catch: (cause) => ToolFailed.make({ tool: `rollup ${input}`, output: String(cause) })
  })

const kilobytes = (bytes: number) => `${(bytes / 1024).toFixed(2)} KB`

/** Bundles each fixture in a package's `bundle/budgets.json` and fails when one exceeds its gzip budget. */
const run = Effect.fn("bundleSize")(
  function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const failures: Array<string> = []

    for (const pkg of yield* publishablePackages(process.cwd())) {
      const budgetsFile = path.join(pkg.dir, "bundle", "budgets.json")
      if (!(yield* fs.exists(budgetsFile))) continue
      const budgets = yield* fs.readFileString(budgetsFile).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Budgets)))

      for (const [fixture, budget] of Object.entries(budgets)) {
        const size = yield* gzippedSize(path.join(pkg.dir, "bundle", fixture))
        const line = `${pkg.name} ${fixture}: ${kilobytes(size)} gzip (budget ${kilobytes(budget)})`
        yield* Console.log(line)
        if (size > budget) failures.push(line)
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
