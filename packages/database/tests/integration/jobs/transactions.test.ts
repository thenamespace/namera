import { expect, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";

import { Repository, TestDatabase, TransactionService } from "../../../src/index.js";
import { DatabaseTestLayer } from "../../fixtures/database.js";

const Persistence = Layer.mergeAll(Repository.layer, TransactionService.layer).pipe(
  Layer.provideMerge(DatabaseTestLayer),
);
const payload = {
  event: "waitlist_joined",
  distinctId: "waitlist:transaction",
  properties: {},
} as const;

layer(Persistence)("repository transaction context", (it) => {
  it.effect("rolls back a successful nested operation with its failing outer transaction", () =>
    Effect.gen(function* () {
      yield* (yield* TestDatabase).reset;
      const repository = (yield* Repository).jobs.analytics;
      const transaction = yield* TransactionService;

      const error = yield* transaction
        .run(
          Effect.gen(function* () {
            yield* repository.enqueue("outer", payload);
            yield* transaction.run(repository.enqueue("inner", payload));
            expect(yield* repository.has("inner")).toBe(true);
            return yield* Effect.fail("outer failure");
          }),
        )
        .pipe(Effect.flip);

      expect(error).toBe("outer failure");
      expect(yield* repository.has("outer")).toBe(false);
      expect(yield* repository.has("inner")).toBe(false);
      yield* repository.enqueue("after-rollback", payload);
      expect(yield* repository.has("after-rollback")).toBe(true);
    }),
  );

  it.effect("joins nested operations rather than silently introducing a savepoint", () =>
    Effect.gen(function* () {
      yield* (yield* TestDatabase).reset;
      const repository = (yield* Repository).jobs.analytics;
      const transaction = yield* TransactionService;
      yield* transaction.run(
        Effect.gen(function* () {
          yield* repository.enqueue("outer", payload);
          const error = yield* transaction
            .run(
              repository.enqueue("inner", payload).pipe(Effect.andThen(Effect.fail("recoverable"))),
            )
            .pipe(Effect.flip);
          expect(error).toBe("recoverable");
        }),
      );
      expect(yield* repository.has("outer")).toBe(true);
      expect(yield* repository.has("inner")).toBe(true);
    }),
  );
});
