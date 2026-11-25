import * as Command from "effect/cli/Command"
import * as Flag from "effect/cli/Flag"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Str from "effect/String"

import { writeFormatted } from "../codegen/formatted.ts"
import { builtContracts, contractsDir } from "../contracts/workspace.ts"
import { type CodeFixture, parseFixtureName, renderDevnetBytecode } from "../devnet/bytecode.ts"
import { SetupError } from "../errors.ts"
import { Tools } from "../services/Tools.ts"

const bytecodeFile = "packages/devnet/src/internal/bytecode.ts"

/**
 * Writes the devnet's bytecode module from the account fixtures and the Foundry build, so the devnet installs the
 * same code the contract tests use. With `check`, fails when the committed module is stale.
 */
export const bytecode = Effect.fn("devnet.bytecode")(
  function*(check: boolean) {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const tools = yield* Tools

    const fixturesDir = path.join(contractsDir, "test", "fixtures", "accounts")
    const fixtures: Array<CodeFixture> = []
    for (const file of yield* fs.readDirectory(fixturesDir)) {
      const parsed = parseFixtureName(file)
      if (parsed === undefined) continue
      fixtures.push({ ...parsed, code: Str.trim(yield* fs.readFileString(path.join(fixturesDir, file))) })
    }
    yield* tools.run("forge", ["build"], { cwd: contractsDir })

    return yield* writeFormatted({
      name: "devnet bytecode",
      outputs: new Map([[path.resolve(bytecodeFile), renderDevnetBytecode(fixtures, yield* builtContracts())]]),
      check,
      fix: "run `pnpm codegen` and commit the result"
    })
  },
  Effect.catchTag("PlatformError", (cause) => SetupError.make({ message: String(cause) }))
)

/** `devnet bytecode [--check]`. */
export const devnetCommand = Command.make("devnet").pipe(
  Command.withDescription("Repository tooling for @namera-ai/devnet"),
  Command.withSubcommands([
    Command.make(
      "bytecode",
      {
        check: Flag.Boolean("check").pipe(
          Flag.withDefault(false),
          Flag.withDescription("Fail when the committed module differs instead of writing it")
        )
      },
      ({ check }) => bytecode(check)
    ).pipe(Command.withDescription("Generate the devnet's bytecode module from the fixtures and the Foundry build"))
  ])
)
