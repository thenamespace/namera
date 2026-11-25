import { Array as Arr, Console, Effect } from "effect"
import { Command } from "effect/cli"
import { globSync } from "glob"
import madge from "madge"

import { CheckFailed, ToolFailed } from "../errors.ts"

/** The import cycles between `files`, one `a.ts -> b.ts` line each (paths relative to their common folder). */
export const findCycles = Effect.fn("circular.findCycles")(function*(files: ReadonlyArray<string>) {
  if (files.length === 0) return []
  const result = yield* Effect.tryPromise({
    try: () =>
      madge([...files], {
        detectiveOptions: { ts: { skipTypeImports: true }, tsx: { skipTypeImports: true } }
      }),
    catch: (cause) => ToolFailed.make({ tool: "madge", output: String(cause) })
  })
  return Arr.map(result.circular(), (cycle) => Arr.join(cycle, " -> "))
})

const run = Effect.fn("circular")(function*() {
  const cycles = yield* findCycles(globSync("packages/*/src/**/*.{ts,tsx}"))
  if (cycles.length > 0) return yield* CheckFailed.make({ check: "circular", problems: cycles })
  yield* Console.log("circular: ok")
})

export const circular = Command.make("circular").pipe(
  Command.withDescription("Fail on import cycles between the modules of the workspace packages"),
  Command.withHandler(() => run())
)
