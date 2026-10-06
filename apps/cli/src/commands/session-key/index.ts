import { Effect, Option, Schema } from "effect";
import { Argument, Command, Flag, Prompt } from "effect/cli";

import { SessionKeyId, WalletId } from "@namera-ai/protocol";

import { profileFlag } from "#/commands/common";
import { nameraCommand } from "#/commands/root";
import { makeCliClient } from "#/services/client";
import { cliFailure } from "#/services/error-feedback";
import { printValue, runPromise } from "#/services/output";
import { terminalText } from "#/services/output/document";
import { sessionKeyView, sessionKeysView } from "#/services/output/session-key";

import { importSessionKeyCommand } from "./import.js";

const list = Command.make(
  "list",
  {
    wallet: Flag.String("wallet").pipe(
      Flag.withDescription("Show keys for this wallet ID only"),
      Flag.optional,
    ),
    profile: profileFlag,
  },
  Effect.fn(function* ({ wallet, profile }) {
    const { client } = yield* Effect.tryPromise(() => makeCliClient(profile));
    const result = yield* runPromise(
      client.sessionKeys.list(
        Option.isSome(wallet)
          ? { walletId: yield* Schema.decodeUnknownEffect(WalletId)(wallet.value) }
          : {},
      ),
    );
    yield* printValue(result, sessionKeysView);
  }),
).pipe(Command.withDescription("List the session keys you can access"));

const get = Command.make(
  "get",
  {
    sessionKeyId: Argument.String("session-key-id").pipe(
      Argument.withDescription("Session key ID; omit to choose a key"),
      Argument.optional,
    ),
    profile: profileFlag,
  },
  Effect.fn(function* ({ sessionKeyId, profile }) {
    const { output, quiet } = yield* nameraCommand;
    if (
      Option.isNone(sessionKeyId) &&
      (output !== "pretty" || quiet || !process.stdin.isTTY || !process.stdout.isTTY)
    ) {
      return yield* Effect.fail(cliFailure("SESSION_KEY_REQUIRED"));
    }
    let id = Option.isSome(sessionKeyId)
      ? yield* Schema.decodeUnknownEffect(SessionKeyId)(sessionKeyId.value)
      : undefined;
    const { client } = yield* Effect.tryPromise(() => makeCliClient(profile));
    if (id === undefined) {
      const keys = yield* runPromise(client.sessionKeys.list());
      if (keys.length === 0) return yield* printValue(keys, sessionKeysView);
      id = yield* Prompt.run(
        Prompt.Select({
          message: "Choose a session key",
          choices: keys.map((key) => ({
            title: terminalText(key.metadata.name),
            description: terminalText(key.wallet.metadata.name),
            value: key.id,
          })),
          maxPerPage: 8,
        }),
      ).pipe(Effect.catchTag("QuitError", () => Effect.interrupt));
    }
    yield* printValue(yield* runPromise(client.sessionKeys.get(id)), sessionKeyView);
  }),
).pipe(Command.withDescription("Choose a session key or enter its ID to see permissions"));

export const sessionKeyCommand = Command.make("session-key").pipe(
  Command.withDescription("View and import session keys"),
  Command.withSubcommands([list, get, importSessionKeyCommand]),
);
