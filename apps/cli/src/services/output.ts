import { Console, DateTime, Effect, Predicate } from "effect";

import type { NameraResult } from "@namera-ai/sdk";

import { nameraCommand } from "#/commands/root";

export type OutputFormat = "pretty" | "json" | "ndjson";

const replacer = (_: string, item: unknown) => (typeof item === "bigint" ? item.toString() : item);

const color = (code: number, value: string, enabled: boolean) =>
  enabled ? `\u001B[${code}m${value}\u001B[0m` : value;

const prettyScalar = (value: unknown, colors: boolean): string => {
  if (value === null) return color(90, "null", colors);
  if (value === undefined) return color(90, "undefined", colors);
  if (Predicate.isString(value)) return color(32, value, colors);
  if (Predicate.isNumber(value) || Predicate.isBigInt(value)) {
    return color(33, String(value), colors);
  }
  if (Predicate.isBoolean(value)) return color(35, String(value), colors);
  if (Predicate.isDate(value)) return color(32, value.toISOString(), colors);
  if (DateTime.isDateTime(value)) return color(32, DateTime.formatIso(value), colors);
  return color(32, String(value), colors);
};

const prettyValue = (value: unknown, colors: boolean, depth = 0): string => {
  const indentation = "  ".repeat(depth);
  if (Array.isArray(value)) {
    if (value.length === 0) return `${indentation}${color(90, "(none)", colors)}`;
    return value
      .map(
        (item, index) =>
          `${indentation}${color(1, `${index + 1}.`, colors)}\n${prettyValue(item, colors, depth + 1)}`,
      )
      .join("\n");
  }
  if (Predicate.isObject(value) && !Predicate.isDate(value) && !DateTime.isDateTime(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return `${indentation}${color(90, "(empty)", colors)}`;
    return entries
      .map(([key, item]) => {
        const label = `${indentation}${color(36, key, colors)}:`;
        return Array.isArray(item) || Predicate.isObject(item)
          ? `${label}\n${prettyValue(item, colors, depth + 1)}`
          : `${label} ${prettyScalar(item, colors)}`;
      })
      .join("\n");
  }
  return `${indentation}${prettyScalar(value, colors)}`;
};

export const formatValue = (
  value: unknown,
  output: OutputFormat,
  options: { readonly colors?: boolean } = {},
): ReadonlyArray<string> => {
  if (output === "pretty") return [prettyValue(value, options.colors ?? false)];
  if (output === "json") return [JSON.stringify(value, replacer)];
  if (Array.isArray(value)) return value.map((item) => JSON.stringify(item, replacer));
  return [JSON.stringify(value, replacer)];
};

export const printValue = Effect.fn("cli.output.printValue")(function* (value: unknown) {
  const { output, quiet } = yield* nameraCommand;
  if (quiet) return;
  const colors = output === "pretty" && process.stdout.isTTY && process.env.NO_COLOR === undefined;
  for (const line of formatValue(value, output, { colors })) yield* Console.log(line);
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
