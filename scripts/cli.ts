import * as Command from "effect/cli/Command"

import { apiSnapshot } from "./commands/apiSnapshot.ts"
import { bundleSize } from "./commands/bundleSize.ts"
import { circular } from "./commands/circular.ts"
import { clean } from "./commands/clean.ts"
import { codegenCommand } from "./commands/codegen.ts"
import { contractsCommand } from "./commands/contracts.ts"
import { devnetCommand } from "./commands/devnet.ts"
import { distTypes } from "./commands/distTypes.ts"
import { lint } from "./commands/lint.ts"
import { oxPin } from "./commands/oxPin.ts"
import { packCheck } from "./commands/packCheck.ts"
import { releaseCommand } from "./commands/release.ts"
import { typeCost } from "./commands/typeCost.ts"

/** `node scripts/bin.ts <command>`: the repository's tooling, run from the repository root. */
export const cli = Command.make("scripts").pipe(
  Command.withDescription("Repository tooling for namera, run from the repository root"),
  Command.withSubcommands([
    apiSnapshot,
    bundleSize,
    circular,
    clean,
    codegenCommand,
    contractsCommand,
    devnetCommand,
    distTypes,
    lint,
    oxPin,
    packCheck,
    releaseCommand,
    typeCost
  ])
)
