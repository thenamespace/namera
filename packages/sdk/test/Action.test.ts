import { assert, describe, it } from "@effect/vitest";
import { Effect, Exit, Schema } from "effect";

import { Action } from "@namera-ai/sdk";

class DivisionByZero extends Schema.TaggedError<
  DivisionByZero,
  { readonly brand: unique symbol }
>()("DivisionByZero", {
  dividend: Schema.Finite,
}) {}

const divide = Action.make(({ dividend, divisor }: { dividend: number; divisor: number }) =>
  divisor === 0
    ? Effect.fail(DivisionByZero.make({ dividend }))
    : Effect.succeed(dividend / divisor),
);

describe("Action", () => {
  it.effect("resolves the promise API with the effect's value", () =>
    Effect.gen(function* () {
      const quotient = yield* Effect.promise(() => divide({ dividend: 6, divisor: 3 }));

      assert.strictEqual(quotient, 2);
    }),
  );

  it.effect("rejects the promise API with the typed failure", () =>
    Effect.gen(function* () {
      const rejection = yield* Effect.promise(() =>
        divide({ dividend: 1, divisor: 0 }).then(
          () => undefined,
          (error: unknown) => error,
        ),
      );

      assert.instanceOf(rejection, DivisionByZero);
    }),
  );

  it.effect("exposes the same implementation as an Effect", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(divide.effect({ dividend: 1, divisor: 0 }));

      assert.deepStrictEqual(exit, Exit.fail(DivisionByZero.make({ dividend: 1 })));
    }),
  );

  it("cannot be reassigned", () => {
    assert.isTrue(Object.isFrozen(divide));
  });
});
