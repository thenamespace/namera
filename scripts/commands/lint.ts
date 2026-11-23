import { Console, Effect } from "effect"
import { Command } from "effect/cli"
import { globSync } from "glob"

import { CheckFailed } from "../errors.ts"

/** JavaScript files under `root/scripts`: repository tooling is TypeScript, written as commands of this CLI. */
export const javaScriptScripts = (root: string) =>
  globSync("scripts/**/*.{js,mjs,cjs,jsx}", { cwd: root, ignore: "**/node_modules/**" }).sort()

const run = Effect.fn("lint")(function*() {
  const problems = javaScriptScripts(process.cwd()).map(
    (file) => `${file}: repository scripts are TypeScript commands in scripts/commands/`
  )
  if (problems.length > 0) return yield* CheckFailed.make({ check: "lint", problems })
  yield* Console.log("lint: ok")
})

export const lint = Command.make("lint").pipe(
  Command.withDescription("Check the repository rules oxlint cannot express"),
  Command.withHandler(() => run())
)
