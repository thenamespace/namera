import * as Command from "effect/cli/Command"

import { contractsCommand } from "./commands/contracts.ts"
import { releaseCommand } from "./commands/release.ts"

/** `namera-dev`: repository tooling, run from the repository root. */
export const cli = Command.make("namera-dev").pipe(
  Command.withDescription("Repository tooling for namera"),
  Command.withSubcommands([contractsCommand, releaseCommand])
)
