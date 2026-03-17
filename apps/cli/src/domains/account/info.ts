import { Console, Effect, type Option } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { AccountManager, KeystoreManager } from "@/layers";

export const accountInfoHandler = (existingAlias: Option.Option<string>) =>
  Effect.gen(function* () {
    const accountManager = yield* AccountManager;
    const keystoreManager = yield* KeystoreManager;

    const account = yield* accountManager.selectAccount({
      existingAlias,
      message: "Select account:",
    });

    const keystore = yield* keystoreManager.getKeystore({
      identifier: account.data.ownerIdentifier,
    });

    yield* Console.log(
      `Smart Account Address: ${account.data.smartAccountAddress}`,
      `\nOwner: ${keystore.keystore.address} (${account.data.ownerType})`,
      `\nKernel Version: ${account.data.kernelVersion}`,
      `\nAccount Index: ${account.data.index}`,
    );
  });

const alias = Flag.string("alias").pipe(
  Flag.optional,
  Flag.withDescription("The alias to use for the account."),
  Flag.withAlias("a"),
);

export const accountInfoCommand = Command.make("info", { alias }, ({ alias }) =>
  accountInfoHandler(alias),
).pipe(
  Command.withAlias("i"),
  Command.withDescription("Get information about a acccount"),
  Command.withExamples([
    {
      command: "namera account info -a my-account",
      description: "Get information about the account with alias 'my-account'",
    },
    {
      command: "namera account info",
      description: "Get information about the account with alias select prompt",
    },
  ]),
);
