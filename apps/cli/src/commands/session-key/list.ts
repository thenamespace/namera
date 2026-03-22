import { Console, Effect, type Option } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { getGlobalFlags } from "@/flags/global";
import { OutputFormatter, SessionKeyManager } from "@/layers";
import { getChain } from "@/schema";

const handler = (flagSmartAccountAlias: Option.Option<string>) =>
  Effect.gen(function* () {
    const sessionKeyManager = yield* SessionKeyManager.SessionKeyManager;
    const outputFormatter = yield* OutputFormatter.OutputFormatter;
    const globalFlags = yield* getGlobalFlags();

    const res = yield* sessionKeyManager.listSessionKeys({
      smartAccount:
        flagSmartAccountAlias._tag === "Some"
          ? flagSmartAccountAlias.value
          : undefined,
    });

    const data = res.map((d) => ({
      alias: d.alias,
      address: d.data.sessionKeyAddress,
      smartAccount: d.data.smartAccountAlias,
      chains: d.data.serializedAccounts
        .map((a) => getChain(a.chain).name)
        .join(", "),
    }));

    if (globalFlags.quite) return;

    const output = yield* outputFormatter.format(data, globalFlags.out);
    yield* Console.log(output);
  });

const smartAccountAlias = Flag.string("smart-account").pipe(
  Flag.withDescription(
    "The alias of the smart account to list session keys for",
  ),
  Flag.withAlias("sa"),
  Flag.optional,
);
/**
 * Command that lists all locally stored session keys.
 */
export const listSessionKeysCommand = Command.make(
  "list",
  { smartAccountAlias },
  ({ smartAccountAlias }) => handler(smartAccountAlias),
).pipe(
  Command.withAlias("ls"),
  Command.withDescription("List session keys"),
  Command.withExamples([
    {
      command: "namera session-key list",
      description: "List all session keys",
    },
    {
      command: "namera session-key list --smart-account my-smart",
      description: "List all session keys for smart account 'my-smart'",
    },
    {
      command: `namera session-key list --params '{"smartAccount":"my-smart"}'`,
      description: "List all session keys for smart account 'my-smart'",
    },
    {
      command: "namera session-key list --output json",
      description: "List all session keys in json format",
    },
    {
      command: "namera schema session-key.list",
      description: "Get the schema for the list session key command",
    },
  ]),
);
