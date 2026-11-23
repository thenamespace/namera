import * as Arr from "effect/Array"
import * as Command from "effect/cli/Command"
import * as Flag from "effect/cli/Flag"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Result from "effect/Result"
import * as Str from "effect/String"

import {
  type BarrelModule,
  duplicateNames,
  exportsMap,
  moduleMetadata,
  parseBarrel,
  renderBarrel
} from "../codegen/barrels.ts"
import { writeFormatted } from "../codegen/formatted.ts"
import { CheckFailed, SetupError } from "../errors.ts"

const versionModule = (version: string) =>
  `// Written by \`node scripts/bin.ts codegen\` from package.json; do not edit.\n/** @internal */\nexport const version = "${version}"\n`

/**
 * Generates a package's barrels and the `exports` maps of its package.json (`publishConfig` too when it publishes),
 * and refreshes `src/internal/version.ts` when the package has one, formatted with dprint. With `check`, writes
 * nothing and fails when a committed file differs or a module lacks its TSDoc.
 */
export const codegen = Effect.fn("codegen")(
  function*(options: { readonly check: boolean; readonly dir: string }) {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const root = path.resolve(options.dir)
    const src = path.join(root, "src")
    const outputs = new Map<string, string>()
    const problems: Array<string> = []

    const indexes = yield* fs.glob("**/index.ts", { root: src, exclude: ["**/internal/**"] })
    for (const index of indexes) {
      const file = path.join(src, index)
      const barrel = parseBarrel(yield* fs.readFileString(file))
      if (barrel === undefined) {
        problems.push(`${file}: an index.ts must be a barrel (\`// @barrel\`)`)
        continue
      }

      const folder = path.dirname(file)
      const matched = yield* fs.glob(barrel.pattern, { root: folder, exclude: ["**/index.ts", "**/internal/**"] })
      const modules: Array<BarrelModule> = []
      for (const module of matched) {
        const metadata = moduleMetadata(yield* fs.readFileString(path.join(folder, module)))
        if (Result.isFailure(metadata)) problems.push(`${path.join(folder, module)}: ${metadata.failure}`)
        else modules.push({ path: module, metadata: metadata.success })
      }
      for (const name of duplicateNames(modules)) {
        problems.push(`${file}: two modules export as ${name}`)
      }
      outputs.set(file, renderBarrel(barrel, modules))
    }

    const folders = Arr.filter(Arr.map(indexes, (index) => path.dirname(index)), (folder) => folder !== ".")
    // Only the outermost `internal` folders: everything below one is already blocked by its entry.
    const internals = Arr.filter(
      Arr.map(yield* fs.glob("**/internal/", { root: src }), (folder) => Str.replace(/\/$/, "")(folder)),
      (folder) => Arr.filter(Str.split(folder, "/"), (segment) => segment === "internal").length === 1
    )

    const manifestFile = path.join(root, "package.json")
    const manifest = JSON.parse(yield* fs.readFileString(manifestFile))
    manifest.exports = exportsMap(folders, internals, (module) => `./src/${module}.ts`)
    if (manifest.private !== true) {
      manifest.publishConfig = {
        ...manifest.publishConfig,
        exports: exportsMap(folders, internals, (module) => `./dist/${module}.js`)
      }
    }
    outputs.set(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)

    const versionFile = path.join(src, "internal", "version.ts")
    if (yield* fs.exists(versionFile)) outputs.set(versionFile, versionModule(manifest.version))

    if (problems.length > 0) return yield* CheckFailed.make({ check: "codegen", problems })

    return yield* writeFormatted({
      name: `codegen ${options.dir}`,
      outputs,
      check: options.check,
      fix: "run `pnpm codegen` and commit the result"
    })
  },
  Effect.catchTag("PlatformError", (cause) => SetupError.make({ message: String(cause) }))
)

/** `codegen [--check] --dir packages/<name>`. */
export const codegenCommand = Command.make(
  "codegen",
  {
    check: Flag.Boolean("check").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Fail when a generated file differs instead of writing it")
    ),
    dir: Flag.String("dir").pipe(Flag.withDescription("The package directory, relative to the repository root"))
  },
  codegen
).pipe(Command.withDescription("Generate a package's barrels, exports maps and version module"))
