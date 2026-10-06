import { Command, Flag } from "effect/cli";

export const outputFlag = Flag.Literals("output", ["pretty", "json"]).pipe(
  Flag.withAlias("o"),
  Flag.withDescription("Choose readable text or full JSON"),
  Flag.withDefault("pretty"),
);

export const quietFlag = Flag.Boolean("quiet").pipe(
  Flag.withAlias("q"),
  Flag.withDescription("Hide results; still show errors"),
  Flag.withDefault(false),
);

export const nameraCommand = Command.make("namera").pipe(
  Command.withSharedFlags({ output: outputFlag, quiet: quietFlag }),
  Command.withDescription("Use your Namera wallets from the terminal"),
);
