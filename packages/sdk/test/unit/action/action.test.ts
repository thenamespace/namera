import { describe, expect, it } from "@effect/vitest";
import { Data, Effect, Exit } from "effect";

import { defineAction } from "@namera-ai/sdk";

class DivisionByZero extends Data.TaggedError("DivisionByZero")<{ readonly dividend: number }> {}

const divide = defineAction(({ dividend, divisor }: { dividend: number; divisor: number }) =>
  divisor === 0
    ? Effect.fail(new DivisionByZero({ dividend }))
    : Effect.succeed(dividend / divisor),
);

describe("defineAction", () => {
  it("resolves the promise API with the effect's value", async () => {
    await expect(divide({ dividend: 6, divisor: 3 })).resolves.toBe(2);
  });

  it("rejects the promise API with the typed failure", async () => {
    await expect(divide({ dividend: 1, divisor: 0 })).rejects.toBeInstanceOf(DivisionByZero);
  });

  it.effect("exposes the same implementation as an Effect", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(divide.effect({ dividend: 1, divisor: 0 }));

      expect(exit).toStrictEqual(Exit.fail(new DivisionByZero({ dividend: 1 })));
    }),
  );

  it("cannot be reassigned", () => {
    expect(Object.isFrozen(divide)).toBe(true);
  });
});
