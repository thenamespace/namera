import { Console, Effect } from "effect";

import type { NameraResult } from "@namera-ai/sdk";

const stringify = (value: unknown) =>
  JSON.stringify(value, (_, item) => (typeof item === "bigint" ? item.toString() : item), 2);

export const printValue = (value: unknown, json: boolean) =>
  Console.log(json || typeof value !== "string" ? stringify(value) : value);

export const unwrapResult = <A, E>(result: NameraResult<A, E>): Effect.Effect<A, Error> =>
  result.success
    ? Effect.succeed(result.data)
    : Effect.fail(
        new Error(
          result.error.kind === "api"
            ? (result.error.code ?? result.error.message)
            : result.error.message,
        ),
      );

export const runPromise = <A, E>(promise: Promise<NameraResult<A, E>>) =>
  Effect.tryPromise(() => promise).pipe(Effect.flatMap(unwrapResult));
