import { Effect } from "effect";
import { Flag, GlobalFlag } from "effect/unstable/cli";

export const globalOutput = GlobalFlag.setting("output")({
  flag: Flag.choice("output", ["pretty", "json", "ndjson"]).pipe(
    Flag.withAlias("o"),
    Flag.withDefault("pretty"),
    Flag.withDescription("Output format (pretty, json, ndjson)"),
  ),
});

export const globalQuite = GlobalFlag.setting("quite")({
  flag: Flag.boolean("quite").pipe(
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
    const quite = yield* globalQuite;
    const params = yield* globalParams;

    return { out, params, quite };
  });

export const globalFlags = [globalOutput, globalQuite, globalParams];
