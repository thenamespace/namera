import * as Command from "effect/cli/Command"

import { codegenCommand } from "./commands/codegen.ts"
import { contractsCommand } from "./commands/contracts.ts"
import { devnetCommand } from "./commands/devnet.ts"
import { releaseCommand } from "./commands/release.ts"

/** `namera-dev`: repository tooling, run from the repository root. */
export const cli = Command.make("namera-dev").pipe(
  Command.withDescription("Repository tooling for namera"),
  Command.withSubcommands([codegenCommand, contractsCommand, devnetCommand, releaseCommand])
)
