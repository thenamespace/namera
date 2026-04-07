import { Console, Effect, type Option, Schema } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { GetSessionKeyInfoParams } from "@/dto";
import { getGlobalFlags } from "@/flags/global";
import { humanizePolicyParams } from "@/helpers/humanize";
import { OutputFormatter, SessionKeyManager } from "@/layers";
import { getChain } from "@/schema";

const handler = (flagAlias: Option.Option<string>) =>
  Effect.gen(function* () {
    const sessionKeyManager = yield* SessionKeyManager.SessionKeyManager;
    const outputFormatter = yield* OutputFormatter.OutputFormatter;

    const globalFlags = yield* getGlobalFlags();

    let params: GetSessionKeyInfoParams;

    if (globalFlags.params._tag === "Some") {
      params = Schema.decodeUnknownSync(
        Schema.fromJsonString(GetSessionKeyInfoParams),
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

    const res = yield* sessionKeyManager.getSessionKey(params);

    const data = {
      alias: res.alias,
      ...(res.data.sessionKeyType === "ecdsa"
        ? {
            address: res.data.sessionKeyAddress,
          }
        : {
            passKeyName: res.data.passKeyName,
          }),
      smartAccount: res.data.smartAccountAlias,
      chains: res.data.serializedAccounts
        .map((a) => getChain(a.chain).name)
        .join(", "),
      policies: humanizePolicyParams(
        res.data.serializedAccounts[0]?.serializedAccount ?? "",
      ),
    };

    if (globalFlags.quiet) return;

    const output = yield* outputFormatter.format(data, globalFlags.out);
    yield* Console.log(output);
  });

const alias = Flag.string("alias").pipe(
  Flag.withDescription("The alias of the session key to get info for"),
  Flag.withAlias("a"),
  Flag.optional,
);

export const getSessionKeyInfoCommand = Command.make(
  "info",
  { alias },
  ({ alias }) => handler(alias),
).pipe(
  Command.withDescription("Get information about a session key"),
  Command.withExamples([
    {
      command: "namera session-key info",
      description: "Get information about a session key with alias prompt",
    },
    {
      command: "namera session-key info --alias my-session-key",
      description:
        "Get information about a session key with alias 'my-session-key'",
    },
    {
      command: `namera session-key info --params '{"alias":"my-session-key"}'`,
      description: "Get information about a session key with json params",
    },
    {
      command: "namera session-key info --alias my-wallet --output json",
      description: "Get information about a session key in json format",
    },
    {
      command: "namera schema session-key.info",
      description: "Get the schema for the session key info command",
    },
  ]),
);
