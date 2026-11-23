import * as Command from "effect/cli/Command"

import { releaseCheckCommand } from "./releaseCheck.ts"
import { releaseSmokeCommand } from "./releaseSmoke.ts"
import { stripInternal } from "./stripInternal.ts"

export const releaseCommand = Command.make("release").pipe(
  Command.withDescription("Prepare the publish build and check packed release tarballs and their published versions"),
  Command.withSubcommands([releaseCheckCommand, releaseSmokeCommand, stripInternal])
)
