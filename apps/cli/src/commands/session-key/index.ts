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
      Flag.withDescription("Only list keys for one wallet"),
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
);

const get = Command.make(
  "get",
  { sessionKeyId: Argument.String("session-key-id"), profile: profileFlag },
  Effect.fn(function* ({ sessionKeyId, profile }) {
    const id = yield* Schema.decodeUnknownEffect(SessionKeyId)(sessionKeyId);
    const { client } = yield* Effect.tryPromise(() => makeCliClient(profile));
    yield* printValue(yield* runPromise(client.sessionKeys.get(id)), sessionKeyView);
  }),
);

export const sessionKeyCommand = Command.make("session-key").pipe(
  Command.withDescription("Read granted session keys and import local signing material"),
  Command.withSubcommands([list, get, importSessionKeyCommand]),
);
