import { Console, Effect, Result } from "effect";
import { Command } from "effect/unstable/cli";

import { AliasManager, SessionKeyManager } from "@/layers";

export const listSessionKeysHandler = () =>
  Effect.gen(function* () {
    const aliasManager = yield* AliasManager;
    const sessionKeyManager = yield* SessionKeyManager;

    const { idToAlias } = yield* aliasManager.getAliasFile("account");

    const results = yield* sessionKeyManager.listSessionKeys();

    for (const res of results) {
      if (Result.isSuccess(res)) {
        const { data, alias } = res.success;
        const { sessionKeyAddress, smartAccountIdentifier } = data;
        const accountAlias = idToAlias.get(smartAccountIdentifier);
        yield* Console.log(
          `${alias ? alias : ""} (${sessionKeyAddress}) ${accountAlias ? `(${accountAlias})` : ""}`,
        );
      }
    }
  });

export const listSessionKeysCommand = Command.make("list", {}, () =>
  listSessionKeysHandler(),
).pipe(
  Command.withAlias("ls"),
  Command.withDescription("List all session keys."),
  Command.withExamples([
    {
      command: "namera session-key list",
      description: "Lists all session keys",
    },
    {
      command: "namera session-key ls",
      description: "Lists all session keys with alias",
    },
  ]),
);
