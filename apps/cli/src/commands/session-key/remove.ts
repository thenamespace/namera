import { Console, Effect, type Option, Schema } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { RemoveSessionKeyParams } from "@/dto";
import { getGlobalFlags } from "@/flags/global";
import { OutputFormatter, SessionKeyManager } from "@/layers";

const handler = (flagAlias: Option.Option<string>) =>
  Effect.gen(function* () {
    const sessionKeyManager = yield* SessionKeyManager.SessionKeyManager;
    const outputFormatter = yield* OutputFormatter.OutputFormatter;
    const globalFlags = yield* getGlobalFlags();

    let params: RemoveSessionKeyParams;

    if (globalFlags.params._tag === "Some") {
      params = Schema.decodeUnknownSync(
        Schema.fromJsonString(RemoveSessionKeyParams),
      )(globalFlags.params.value);
    } else {
      let alias: string;

      if (flagAlias._tag === "Some") {
        alias = flagAlias.value;
      } else {
        const res = yield* sessionKeyManager.selectSessionKey({
          message: "Select Session Key:",
        });
        alias = res.alias;
      }

      params = { alias };
    }

    yield* sessionKeyManager.removeSessionKey(params);

    const data = { success: true };

    if (globalFlags.quiet) return;
    const output = yield* outputFormatter.format(data, globalFlags.out);
    yield* Console.log(output);
  });

const alias = Flag.string("alias").pipe(
  Flag.withDescription("The alias of the session key to remove"),
  Flag.withAlias("a"),
  Flag.optional,
);

export const removeSessionKeyCommand = Command.make(
  "remove",
  { alias },
  ({ alias }) => handler(alias),
).pipe(
  Command.withAlias("rm"),
  Command.withDescription("Remove a Session Key"),
  Command.withExamples([
    {
      command: "namera session-key remove",
      description: "Remove a session key with alias prompt",
    },
    {
      command: "namera session-key remove --alias my-session-key",
      description: "Remove a session key with alias 'my-session-key'",
    },
    {
      command: `namera session-key remove --params '{"alias":"my-session-key"}'`,
      description: "Remove a session key with json params",
    },
    {
      command: "namera schema session-key.remove",
      description: "Get the schema for the remove session key command",
    },
  ]),
);
