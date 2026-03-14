import { Effect } from "effect";
import { Prompt } from "effect/unstable/cli";

import type { TimestampPolicyData } from "./types";

export const getTimestampPolicyParams = Effect.gen(function* () {
  const validAfter = yield* Prompt.date({
    initial: new Date(),
    message: "Time after which the key becomes valid.",
    validate: (d) =>
      Effect.gen(function* () {
        if (d < new Date())
          return yield* Effect.fail("Date must be in the future");
        return d;
      }),
  });

  const validUntil = yield* Prompt.date({
    initial: new Date(),
    message: "Time until which the key becomes valid.",
    validate: (d) =>
      Effect.gen(function* () {
        if (d < new Date())
          return yield* Effect.fail("Date must be in the future");
        if (d < validAfter)
          return yield* Effect.fail("Valid until must be after valid after");
        return d;
      }),
  });

  return {
    data: { validAfter, validUntil },
    type: "timestamp",
  } satisfies TimestampPolicyData;
});
