import { Console, Effect, type Option } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { AccountManager, SessionKeyManager } from "@/layers";

import { formatSessionKeyData } from "./helpers";

export const sessionKeyInfoHandler = (existingAlias: Option.Option<string>) =>
  Effect.gen(function* () {
    const sessionKeyManager = yield* SessionKeyManager;
    const accountManager = yield* AccountManager;

    const sessionKey = yield* sessionKeyManager.selectSessionKey({
      existingAlias,
      message: "Select Session Key:",
    });

    const account = yield* accountManager.getAccount({
      identifier: sessionKey.data.smartAccountIdentifier,
    });

    yield* Console.log(
      `Session Key Address: ${sessionKey.data.sessionKeyAddress}`,
      `\nSmart Account Address: ${account.data.smartAccountAddress}`,
      formatSessionKeyData(sessionKey),
    );
  });

const alias = Flag.string("alias").pipe(
  Flag.optional,
  Flag.withDescription("The alias to use for the session key."),
  Flag.withAlias("a"),
);

export const sessionKeyInfoCommand = Command.make(
  "info",
  { alias },
  ({ alias }) => sessionKeyInfoHandler(alias),
).pipe(
  Command.withAlias("i"),
  Command.withDescription("Get information about a session key"),
  Command.withExamples([
    {
      command: "namera session-key info -a my-session-key",
      description:
        "Get information about the session key with alias 'my-session-key'",
    },
    {
      command: "namera session-key info",
      description:
        "Get information about the session key with alias select prompt",
    },
  ]),
);
