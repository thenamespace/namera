import { Effect } from "effect";
import { Command } from "effect/unstable/cli";

import { createKeystoreCommand } from "./create";
import { decryptKeystoreCommand } from "./decrypt";
import { getKeystoreInfoCommand } from "./info";
import { listKeystoresCommand } from "./list";

/**
 * Command group for keystore-related operations.
 */
export const keystoreCommands = Command.make(
  "keystore",
  {},
  () => Effect.void,
).pipe(
  Command.withDescription("Keystore management utilities."),
  Command.withAlias("k"),
  Command.withSubcommands([
    createKeystoreCommand,
    listKeystoresCommand,
    getKeystoreInfoCommand,
    decryptKeystoreCommand,
  ]),
);
