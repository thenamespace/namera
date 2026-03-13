import { Console, Effect, Result } from "effect";
import { Command } from "effect/unstable/cli";

import { AccountManager } from "@/layers";

export const listAccountsHandler = () =>
  Effect.gen(function* () {
    const accountManager = yield* AccountManager;

    const results = yield* accountManager.listAccounts();

    for (const res of results) {
      if (Result.isSuccess(res)) {
        const { data, alias } = res.success;
        const { smartAccountAddress } = data;
        yield* Console.log(
          `${alias ? alias : ""} (${smartAccountAddress}) (Local)`,
        );
      }
    }
  });

export const listAccountsCommand = Command.make("list", {}, () =>
  listAccountsHandler(),
).pipe(
  Command.withAlias("ls"),
  Command.withDescription("List all smart accounts."),
  Command.withExamples([
    {
      command: "namera account list",
      description: "Lists all smart accounts",
    },
    {
      command: "namera account ls",
      description: "Lists all smart accounts with alias",
    },
  ]),
);
