import { Console, Effect } from "effect";

import type { NameraResult } from "@namera-ai/sdk";

import { nameraCommand } from "#/commands/root";

export type OutputFormat = "pretty" | "json" | "ndjson";

const replacer = (_: string, item: unknown) => (typeof item === "bigint" ? item.toString() : item);

export const formatValue = (value: unknown, output: OutputFormat): ReadonlyArray<string> => {
  if (output === "pretty") {
    return [typeof value === "string" ? value : JSON.stringify(value, replacer, 2)];
  }
  if (output === "json") return [JSON.stringify(value, replacer)];
  if (Array.isArray(value)) return value.map((item) => JSON.stringify(item, replacer));
  return [JSON.stringify(value, replacer)];
};

export const printValue = Effect.fn("cli.output.printValue")(function* (value: unknown) {
  const { output, quiet } = yield* nameraCommand;
  if (quiet) return;
  for (const line of formatValue(value, output)) yield* Console.log(line);
});

export const printLine = Effect.fn("cli.output.printLine")(function* (value: string) {
  const { quiet } = yield* nameraCommand;
  if (!quiet) yield* Console.log(value);
});

export const unwrapResult = <A, E>(result: NameraResult<A, E>): Effect.Effect<A, Error> =>
  result.success
    ? Effect.succeed(result.data)
    : Effect.fail(
        new Error(
          result.error.kind === "api"
            ? result.error.code === undefined
              ? result.error.message
              : `${result.error.code}: ${result.error.message}`
            : result.error.message,
        ),
      );

export const runPromise = <A, E>(promise: Promise<NameraResult<A, E>>) =>
  Effect.tryPromise(() => promise).pipe(Effect.flatMap(unwrapResult));
