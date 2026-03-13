import { Console, Effect, Result } from "effect";
import { Command } from "effect/unstable/cli";

import { KeystoreManager } from "@/layers";

export const listWalletsHandler = () =>
  Effect.gen(function* () {
    const keystoreManager = yield* KeystoreManager;

    const results = yield* keystoreManager.listKeystores();

    for (const res of results) {
      if (Result.isSuccess(res)) {
        const { keystore, alias } = res.success;
        const { address } = keystore;
        yield* Console.log(`${alias} ${address ? `(${address})` : ""} (Local)`);
      }
    }
  });

export const listWalletsCommand = Command.make("list", {}, () =>
  listWalletsHandler(),
).pipe(
  Command.withAlias("ls"),
  Command.withDescription(
    "List all the accounts in the keystore default directory",
  ),
  Command.withExamples([
    {
      command: "namera wallet list",
      description: "Lists all the wallets",
    },
  ]),
);
