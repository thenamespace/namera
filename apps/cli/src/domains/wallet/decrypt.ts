import { Console, Effect, type Option } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { KeystoreManager } from "@/layers";

export const decryptWalletHandler = (existingAlias: Option.Option<string>) =>
  Effect.gen(function* () {
    const keystoreManager = yield* KeystoreManager;

    const keystore = yield* keystoreManager.selectKeystore({
      alias: existingAlias,
      message: "Select wallet to decrypt:",
    });

    const { address, privateKey } =
      yield* keystoreManager.decryptKeystore(keystore);

    yield* Console.log(`Address: ${address}`, `\nPrivate Key: ${privateKey}`);
  });

const alias = Flag.string("alias").pipe(
  Flag.optional,
  Flag.withDescription("The alias to use for the wallet."),
  Flag.withAlias("a"),
);

export const decryptWalletCommand = Command.make(
  "decrypt",
  { alias },
  ({ alias }) => decryptWalletHandler(alias),
).pipe(
  Command.withAlias("dk"),
  Command.withDescription("Decrypts a keystore to get the private key"),
  Command.withExamples([
    {
      command: "namera wallet decrypt-keystore -a my-wallet",
      description: "Decrypts the keystore with alias 'my-wallet'",
    },
    {
      command: "namera wallet decrypt-keystore",
      description: "Decrypts the keystore with alias select prompt",
    },
  ]),
);
