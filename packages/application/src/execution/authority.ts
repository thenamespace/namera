import { Effect } from "effect";

import { ExecutionError } from "@namera-ai/protocol";

import { makeLoadSessionAuthority } from "#/session-key/authority";

export const makeLoadExecutionAuthority = Effect.gen(function* () {
  const load = yield* makeLoadSessionAuthority;
  return Effect.fnUntraced(function* (input: Parameters<typeof load>[0]) {
    return yield* load(input).pipe(
      Effect.catchTag(
        "SessionKeyOperationError",
        (error) =>
          new ExecutionError({
            code:
              error.code === "OPERATION_UNAVAILABLE"
                ? "NO_AUTHORIZED_SESSION_KEY"
                : "EXECUTION_UNAVAILABLE",
          }),
      ),
    );
  });
});
