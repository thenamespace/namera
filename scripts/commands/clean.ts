import { Console, Effect, FileSystem, Path } from "effect"
import { Command } from "effect/cli"
import { globSync } from "glob"

const outputs = ["dist", "build", "coverage", ".data", "tmp", "tsconfig.tsbuildinfo"]

/** Removes build output and caches from `root` and each of its packages and apps. */
export const cleanWorkspace = Effect.fn("clean.cleanWorkspace")(function*(root: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const folders = [root, ...globSync(["packages/*/", "apps/*/"], { cwd: root, absolute: true })]
  const files = globSync("*.tsbuildinfo", { cwd: root, absolute: true })
  const targets = [...folders.flatMap((folder) => outputs.map((output) => path.join(folder, output))), ...files]
  yield* Effect.forEach(targets, (target) => fs.remove(target, { recursive: true, force: true }), { discard: true })
})

export const clean = Command.make("clean").pipe(
  Command.withDescription("Remove build output and caches"),
  Command.withHandler(() => cleanWorkspace(process.cwd()).pipe(Effect.andThen(Console.log("clean: ok"))))
)
