import { Cause, Console, Effect } from "effect";
import { CliError, CliOutput } from "effect/cli";

import { cliFailure, errorFeedback, formatFailure, CliFailure } from "./error-feedback.js";

const parserFailure = (error: CliError.CliError): CliFailure => {
  const detail = error instanceof CliError.ShowHelp ? error.errors[0] : error;
  const base = cliFailure("INVALID_ARGUMENT");
  // Missing-input messages contain declared field names, never the user's values.
  if (detail instanceof CliError.MissingArgument || detail instanceof CliError.MissingOption)
    return new CliFailure({ ...base, message: detail.message });
  const messages = [
    [CliError.UnrecognizedOption, "The command contains an unknown flag."],
    [CliError.UnknownSubcommand, "That subcommand is not available."],
    [CliError.DuplicateOption, "A flag was provided more than once."],
    [CliError.UnexpectedArgument, "The command contains an unexpected argument."],
    [CliError.InvalidValue, "An argument or flag has an invalid value."],
  ] as const;
  return new CliFailure({
    ...base,
    message: messages.find(([type]) => detail instanceof type)?.[1] ?? base.message,
  });
};

// Available even when argument parsing fails, before shared flags have a value.
export const structuredErrors = (args: readonly string[]): boolean => {
  let format = "pretty";
  for (let index = 0; index < args.length && args[index] !== "--"; index++) {
    const arg = args[index];
    if (arg === undefined) break;
    if (arg === "--output" || arg === "-o") format = args[++index] ?? "pretty";
    else if (arg.startsWith("--output=")) format = arg.slice(9);
    else if (arg.startsWith("-o=")) format = arg.slice(3);
  }
  return format === "json" || format === "ndjson";
};

export const reportCommandErrors = Effect.fn("cli.reportCommandErrors")(function* <A, E, R>(
  program: Effect.Effect<A, E, R>,
) {
  const console = yield* Console.Console;
  let help = "";
  const formatter = CliOutput.defaultFormatter({ colors: false });
  return yield* program.pipe(
    // Delay help until we know whether it was requested or caused by bad input.
    Effect.provide(
      CliOutput.layer({
        ...formatter,
        formatHelpDoc: (doc) => {
          help = formatter.formatHelpDoc(doc);
          return "";
        },
      }),
    ),
    Effect.provideService(Console.Console, {
      ...console,
      log: (...values) => {
        if (values.length === 1 && values[0] === "") return;
        console.log(...values);
      },
    }),
    Effect.tap(() => (help ? Console.log(help) : Effect.void)),
    Effect.catchCause((cause): Effect.Effect<void, E | CliFailure> => {
      if (cause.reasons.every(Cause.isInterruptReason)) return Effect.failCause(cause);
      const error = Cause.squash(cause);
      if (error instanceof CliError.ShowHelp && error.errors.length === 0) return Console.log(help);
      const failure = CliError.isCliError(error) ? parserFailure(error) : errorFeedback(error);
      return Console.error(formatFailure(failure, structuredErrors(process.argv.slice(2)))).pipe(
        Effect.andThen(Effect.fail(failure)),
      );
    }),
  );
});
