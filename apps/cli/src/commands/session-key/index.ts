import { Effect, Option, Schema } from "effect";
import { Argument, Command, Flag } from "effect/cli";

import { SessionKeyId, WalletId } from "@namera-ai/protocol";

import { profileFlag } from "#/commands/common";
import { makeCliClient } from "#/services/client";
import { printValue, runPromise } from "#/services/output";
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
      Argument.withDescription("Session key ID from session-key list"),
    ),
    profile: profileFlag,
  },
  Effect.fn(function* ({ sessionKeyId, profile }) {
    const id = yield* Schema.decodeUnknownEffect(SessionKeyId)(sessionKeyId);
    const { client } = yield* Effect.tryPromise(() => makeCliClient(profile));
    yield* printValue(yield* runPromise(client.sessionKeys.get(id)), sessionKeyView);
  }),
).pipe(Command.withDescription("Show a session key's details and permissions"));

export const sessionKeyCommand = Command.make("session-key").pipe(
  Command.withDescription("View and import session keys"),
  Command.withSubcommands([list, get, importSessionKeyCommand]),
);
