import { Effect, Schema } from "effect";
import { Argument, Command } from "effect/cli";

import { WalletId } from "@namera-ai/protocol";

import { profileFlag } from "#/commands/common";
import { makeCliClient } from "#/services/client";
import { printValue, runPromise } from "#/services/output";
import { walletView, walletsView } from "#/services/output/wallet";

const list = Command.make(
  "list",
  { profile: profileFlag },
  Effect.fn(function* ({ profile }) {
    const { client } = yield* Effect.tryPromise(() => makeCliClient(profile));
    yield* printValue(yield* runPromise(client.wallets.list()), walletsView);
  }),
).pipe(Command.withDescription("List the wallets you can access"));

const get = Command.make(
  "get",
  {
    walletId: Argument.String("wallet-id").pipe(
      Argument.withDescription("Wallet ID from wallet list"),
    ),
    profile: profileFlag,
  },
  Effect.fn(function* ({ walletId, profile }) {
    const id = yield* Schema.decodeUnknownEffect(WalletId)(walletId);
    const { client } = yield* Effect.tryPromise(() => makeCliClient(profile));
    yield* printValue(yield* runPromise(client.wallets.get(id)), walletView);
  }),
).pipe(Command.withDescription("Show a wallet's details"));

export const walletCommand = Command.make("wallet").pipe(
  Command.withDescription("View your wallets"),
  Command.withSubcommands([list, get]),
);
