import { Effect } from "effect";
import { CliError, Command } from "effect/unstable/cli";

import { createKeystoreCommand } from "./create";
import { decryptKeystoreCommand } from "./decrypt";
import { importKeystoreCommand } from "./import";
import { getKeystoreInfoCommand } from "./info";
import { listKeystoresCommand } from "./list";
import { removeKeystoreCommand } from "./remove";

/**
 * Command group for keystore-related operations.
 */
export const keystoreCommands = Command.make("keystore", {}, () =>
  Effect.fail(
    new CliError.ShowHelp({
      commandPath: ["namera", "keystore"],
      errors: [],
    }),
  ),
).pipe(
  Command.withDescription("Keystore management utilities."),
  Command.withAlias("k"),
  Command.withSubcommands([
    createKeystoreCommand,
    listKeystoresCommand,
    getKeystoreInfoCommand,
    decryptKeystoreCommand,
    importKeystoreCommand,
    removeKeystoreCommand,
  ]),
);
