import { Effect, Schema } from "effect";
import { Argument, Command } from "effect/unstable/cli";

import { WalletId } from "@namera-ai/protocol";

import { jsonFlag, profileFlag } from "#/commands/common";
import { makeCliClient } from "#/services/client";
import { printValue, runPromise } from "#/services/output";

const list = Command.make(
  "list",
  { profile: profileFlag, json: jsonFlag },
  Effect.fn(function* ({ profile, json }) {
    const { client } = yield* Effect.tryPromise(() => makeCliClient(profile));
    yield* printValue(yield* runPromise(client.wallets.list()), json);
  }),
);

const get = Command.make(
  "get",
  { walletId: Argument.string("wallet-id"), profile: profileFlag, json: jsonFlag },
  Effect.fn(function* ({ walletId, profile, json }) {
    const id = yield* Schema.decodeUnknownEffect(WalletId)(walletId);
    const { client } = yield* Effect.tryPromise(() => makeCliClient(profile));
    yield* printValue(yield* runPromise(client.wallets.get(id)), json);
  }),
);

export const walletCommand = Command.make("wallet").pipe(
  Command.withDescription("Read wallets granted to this CLI"),
  Command.withSubcommands([list, get]),
);
