import { Console, Effect, type Option } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { KeystoreManager } from "@/layers";

export const walletInfoHandler = (existingAlias: Option.Option<string>) =>
  Effect.gen(function* () {
    const keystoreManager = yield* KeystoreManager;

    const keystore = yield* keystoreManager.selectKeystore({
      alias: existingAlias,
      message: "Select wallet:",
    });

    yield* Console.log(`Address: ${keystore.keystore.address}`);
  });

const alias = Flag.string("alias").pipe(
  Flag.optional,
  Flag.withDescription("The alias to use for the wallet."),
  Flag.withAlias("a"),
);

export const walletInfoCommand = Command.make("info", { alias }, ({ alias }) =>
  walletInfoHandler(alias),
).pipe(
  Command.withAlias("i"),
  Command.withDescription("Get information about a wallet"),
  Command.withExamples([
    {
      command: "namera wallet info -a my-wallet",
      description: "Get information about the keystore with alias 'my-wallet'",
    },
    {
      command: "namera wallet info",
      description:
        "Get information about the keystore with alias select prompt",
    },
  ]),
);
