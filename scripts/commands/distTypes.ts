import { Console, Effect, FileSystem, Formatter, Path } from "effect"
import { Command } from "effect/cli"
import { globSync } from "glob"

import { SetupError } from "../errors.ts"
import { Tools } from "../services/Tools.ts"

/**
 * Type-checks every built declaration file with `skipLibCheck: false`, as a consumer's compiler does:
 * a broken public type fails here, not in a user's project. Run after `pnpm build`.
 */
const run = Effect.fn("distTypes")(
  function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const tools = yield* Tools
    const root = process.cwd()

    const declarations = globSync("packages/*/dist/**/*.d.ts", { cwd: root, absolute: true })
    const unbuilt = globSync("packages/*/", { cwd: root, absolute: true }).filter(
      (folder) => !declarations.some((file) => file.startsWith(path.join(folder, "dist") + path.sep))
    )
    if (unbuilt.length > 0) {
      return yield* SetupError.make({
        message: `${
          unbuilt.map((folder) => path.relative(root, folder)).join(", ")
        }: no declarations; run \`pnpm build\``
      })
    }

    const dir = yield* fs.makeTempDirectoryScoped({ prefix: "dist-types-" })
    const tsconfig = path.join(dir, "tsconfig.json")
    yield* fs.writeFileString(
      tsconfig,
      Formatter.formatJson({
        compilerOptions: {
          strict: true,
          noEmit: true,
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          skipLibCheck: false,
          types: ["node"],
          typeRoots: [path.join(root, "node_modules", "@types")]
        },
        files: declarations
      })
    )
    yield* tools.run("pnpm", ["exec", "tsc", "-p", tsconfig], { cwd: root })
    yield* Console.log(`dist-types: ok (${declarations.length} declaration files)`)
  },
  Effect.scoped,
  Effect.catchTag("PlatformError", (cause) => SetupError.make({ message: String(cause) }))
)

export const distTypes = Command.make("dist-types").pipe(
  Command.withDescription("Type-check the built declarations as a consumer would"),
  Command.withHandler(() => run())
)
