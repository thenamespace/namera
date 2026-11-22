import * as Arr from "effect/Array"
import * as Command from "effect/cli/Command"
import * as Flag from "effect/cli/Flag"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Result from "effect/Result"
import * as Str from "effect/String"

import { builtContracts, contractsDir } from "../contracts/workspace.ts"
import { CheckFailed, SetupError } from "../errors.ts"
import {
  type BarrelModule,
  duplicateNames,
  exportsMap,
  moduleMetadata,
  parseBarrel,
  renderBarrel
} from "../sdk/barrels.ts"
import { type CodeFixture, parseFixtureName, renderTestChainBytecode } from "../sdk/testChainBytecode.ts"
import { Tools } from "../services/Tools.ts"

const versionModule = (version: string) =>
  `// Written by \`namera-dev sdk codegen\` from package.json; do not edit.\n/** @internal */\nexport const version = "${version}"\n`

/**
 * Generates the SDK's barrels, the `exports` maps of its package.json, `src/internal/version.ts` and the test chain's
 * bytecode module, formatted with dprint. With `check`, writes nothing and fails when a committed file differs or a module lacks its TSDoc.
 */
export const codegen = Effect.fn("sdk.codegen")(
  function*(options: { readonly check: boolean; readonly dir: string }) {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const tools = yield* Tools

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
    manifest.publishConfig = {
      ...manifest.publishConfig,
      exports: exportsMap(folders, internals, (module) => `./dist/${module}.js`)
    }
    outputs.set(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)
    outputs.set(path.join(src, "internal", "version.ts"), versionModule(manifest.version))

    const fixturesDir = path.join(contractsDir, "test", "fixtures", "accounts")
    const fixtures: Array<CodeFixture> = []
    for (const file of yield* fs.readDirectory(fixturesDir)) {
      const parsed = parseFixtureName(file)
      if (parsed === undefined) continue
      fixtures.push({ ...parsed, code: Str.trim(yield* fs.readFileString(path.join(fixturesDir, file))) })
    }
    yield* tools.run("forge", ["build"], { cwd: contractsDir })
    outputs.set(
      path.join(src, "testing", "internal", "bytecode.ts"),
      renderTestChainBytecode(fixtures, yield* builtContracts())
    )

    if (problems.length > 0) return yield* CheckFailed.make({ check: "sdk codegen", problems })

    const staging = yield* fs.makeTempDirectoryScoped({ prefix: "namera-sdk-" })
    const staged = new Map<string, string>()
    for (const [file, content] of outputs) {
      const target = path.join(staging, path.relative(root, file))
      yield* fs.makeDirectory(path.dirname(target), { recursive: true })
      yield* fs.writeFileString(target, content)
      staged.set(file, target)
    }
    yield* tools.run("pnpm", [
      "exec",
      "dprint",
      "fmt",
      "--config",
      path.resolve("dprint.json"),
      ...staged.values()
    ])

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
      return yield* CheckFailed.make({
        check: "sdk codegen --check",
        problems: [...stale, "run `pnpm --filter @namera-ai/sdk codegen` and commit the result"]
      })
    }
    return yield* Console.log(`sdk codegen: ${options.check ? "up to date" : "wrote"} (${outputs.size} files)`)
  },
  Effect.scoped,
  Effect.catchTag("PlatformError", (cause) => SetupError.make({ message: String(cause) }))
)

/** `sdk codegen [--check] [--dir packages/sdk]`. */
export const sdkCommand = Command.make("sdk").pipe(
  Command.withDescription("Repository tooling for @namera-ai/sdk"),
  Command.withSubcommands([
    Command.make(
      "codegen",
      {
        check: Flag.Boolean("check").pipe(
          Flag.withDefault(false),
          Flag.withDescription("Fail when a generated file differs instead of writing it")
        ),
        dir: Flag.String("dir").pipe(
          Flag.withDefault("packages/sdk"),
          Flag.withDescription("The package directory, relative to the working directory")
        )
      },
      codegen
    ).pipe(Command.withDescription("Generate the SDK's barrels, exports maps, version module and test chain bytecode"))
  ])
)
