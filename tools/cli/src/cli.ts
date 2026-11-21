import { Command } from "effect/cli";

import { releaseCommand } from "./commands/release.ts";

/** `namera-dev`: repository tooling, run from the repository root. */
export const cli = Command.make("namera-dev").pipe(
  Command.withDescription("Repository tooling for namera"),
  Command.withSubcommands([releaseCommand]),
);
