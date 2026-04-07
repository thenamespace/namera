import { Effect } from "effect";
import { Flag, GlobalFlag } from "effect/unstable/cli";

export const globalOutput = GlobalFlag.setting("output")({
  flag: Flag.choice("output", ["pretty", "json", "ndjson"]).pipe(
    Flag.withAlias("o"),
    Flag.withDefault("pretty"),
    Flag.withDescription("Output format (pretty, json, ndjson)"),
  ),
});

export const globalQuiet = GlobalFlag.setting("quiet")({
  flag: Flag.boolean("quiet").pipe(
    Flag.withAlias("q"),
    Flag.withDefault(false),
    Flag.withDescription("Do not print output"),
  ),
});

export const globalParams = GlobalFlag.setting("params")({
  flag: Flag.string("params").pipe(
    Flag.optional,
    Flag.withDescription("JSON Parameters to pass to the command"),
  ),
});

export const getGlobalFlags = () =>
  Effect.gen(function* () {
    const out = yield* globalOutput;
    const quiet = yield* globalQuiet;
    const params = yield* globalParams;

    return { out, params, quiet };
  });

export const globalFlags = [globalOutput, globalQuiet, globalParams];
