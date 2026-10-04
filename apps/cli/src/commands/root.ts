import { Command, Flag } from "effect/cli";

export const outputFlag = Flag.Literals("output", ["pretty", "json", "ndjson"]).pipe(
  Flag.withAlias("o"),
  Flag.withDescription("Output format"),
  Flag.withDefault("pretty"),
);

export const quietFlag = Flag.Boolean("quiet").pipe(
  Flag.withAlias("q"),
  Flag.withDescription("Suppress command output"),
  Flag.withDefault(false),
);

export const nameraCommand = Command.make("namera").pipe(
  Command.withSharedFlags({ output: outputFlag, quiet: quietFlag }),
  Command.withDescription("Manage Namera wallets through delegated session-key grants"),
);
