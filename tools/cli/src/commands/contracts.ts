import * as Command from "effect/cli/Command"

import { chainCommands } from "./contractsChains.ts"
import { generateCommand } from "./contractsGenerate.ts"

export const contractsCommand = Command.make("contracts").pipe(
  Command.withDescription(
    "Deploy Namera's contracts, record their provenance and generate @namera-ai/contracts"
  ),
  Command.withSubcommands([...chainCommands, generateCommand])
)
