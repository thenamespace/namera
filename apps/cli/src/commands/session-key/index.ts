import { Effect, Option, Schema } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";

import { SessionKeyId, WalletId } from "@namera-ai/protocol";

import { jsonFlag, profileFlag } from "#/commands/common";
import { makeCliClient } from "#/services/client";
import { printValue, runPromise } from "#/services/output";

const list = Command.make(
  "list",
  {
    wallet: Flag.string("wallet").pipe(
      Flag.withDescription("Only list keys for one wallet"),
      Flag.optional,
    ),
    profile: profileFlag,
    json: jsonFlag,
  },
  Effect.fn(function* ({ wallet, profile, json }) {
    const { client } = yield* Effect.tryPromise(() => makeCliClient(profile));
    const result = yield* runPromise(
      client.sessionKeys.list(
        Option.isSome(wallet)
          ? { walletId: yield* Schema.decodeUnknownEffect(WalletId)(wallet.value) }
          : {},
      ),
    );
    yield* printValue(result, json);
  }),
);

const get = Command.make(
  "get",
  { sessionKeyId: Argument.string("session-key-id"), profile: profileFlag, json: jsonFlag },
  Effect.fn(function* ({ sessionKeyId, profile, json }) {
    const id = yield* Schema.decodeUnknownEffect(SessionKeyId)(sessionKeyId);
    const { client } = yield* Effect.tryPromise(() => makeCliClient(profile));
    yield* printValue(yield* runPromise(client.sessionKeys.get(id)), json);
  }),
);

export const sessionKeyCommand = Command.make("session-key").pipe(
  Command.withDescription("Read granted session keys"),
  Command.withSubcommands([list, get]),
);
