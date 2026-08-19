import { Command, Flag } from "effect/unstable/cli";

export const outputFlag = Flag.choice("output", ["pretty", "json", "ndjson"]).pipe(
  Flag.withAlias("o"),
  Flag.withDescription("Output format"),
  Flag.withDefault("pretty"),
);

export const quietFlag = Flag.boolean("quiet").pipe(
  Flag.withAlias("q"),
  Flag.withDescription("Suppress command output"),
);

export const nameraCommand = Command.make("namera").pipe(
  Command.withSharedFlags({ output: outputFlag, quiet: quietFlag }),
  Command.withDescription("Manage Namera wallets through delegated session-key grants"),
);
