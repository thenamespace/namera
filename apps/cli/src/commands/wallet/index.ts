import { Effect, Option, Schema } from "effect";
import { Argument, Command, Prompt } from "effect/cli";

import { WalletId } from "@namera-ai/protocol";

import { profileFlag } from "#/commands/common";
import { nameraCommand } from "#/commands/root";
import { makeCliClient } from "#/services/client";
import { cliFailure } from "#/services/error-feedback";
import { printValue, runPromise } from "#/services/output";
import { humanize, named, terminalText } from "#/services/output/document";
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
      Argument.withDescription("Wallet ID; omit to choose a wallet"),
      Argument.optional,
    ),
    profile: profileFlag,
  },
  Effect.fn(function* ({ walletId, profile }) {
    const { output, quiet } = yield* nameraCommand;
    if (
      Option.isNone(walletId) &&
      (output !== "pretty" || quiet || !process.stdin.isTTY || !process.stdout.isTTY)
    ) {
      return yield* Effect.fail(cliFailure("WALLET_REQUIRED"));
    }
    let id = Option.isSome(walletId)
      ? yield* Schema.decodeUnknownEffect(WalletId)(walletId.value)
      : undefined;
    const { client } = yield* Effect.tryPromise(() => makeCliClient(profile));
    if (id === undefined) {
      const wallets = yield* runPromise(client.wallets.list());
      if (wallets.length === 0) return yield* printValue(wallets, walletsView);
      id = yield* Prompt.run(
        Prompt.Select({
          message: "Choose a wallet",
          choices: wallets.map((wallet) => ({
            title: terminalText(`${named(wallet.metadata)} | ${humanize(wallet.status)}`),
            description: terminalText(`${wallet.address} | EVM`),
            value: wallet.id,
          })),
          maxPerPage: 8,
        }),
      ).pipe(Effect.catchTag("QuitError", () => Effect.interrupt));
    }
    yield* printValue(yield* runPromise(client.wallets.get(id)), walletView);
  }),
).pipe(Command.withDescription("Choose a wallet or enter its ID to see details"));

export const walletCommand = Command.make("wallet").pipe(
  Command.withDescription("View your wallets"),
  Command.withSubcommands([list, get]),
);
