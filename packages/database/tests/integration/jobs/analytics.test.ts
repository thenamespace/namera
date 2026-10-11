import { expect, layer } from "@effect/vitest";
import { DateTime, Effect, Layer } from "effect";
import { TestClock } from "effect/testing";

import { Database, Repository, TestDatabase, TransactionService } from "../../../src/index.js";

const Persistence = Layer.mergeAll(Repository.layer, TransactionService.layer).pipe(
  Layer.provideMerge(TestDatabase.layer),
);
const payload = {
  event: "waitlist_joined" as const,
  distinctId: "waitlist:fixture",
  properties: {},
};

layer(Persistence)("analytics outbox", (it) => {
  it.effect("rolls back with the business transaction and deduplicates committed events", () =>
    Effect.gen(function* () {
      yield* (yield* TestDatabase).reset;
      const repository = (yield* Repository).jobs.analytics;
      const transaction = yield* TransactionService;
      yield* transaction
        .run(
          repository.enqueue("rolled-back", payload).pipe(Effect.andThen(Effect.fail("rollback"))),
        )
        .pipe(Effect.exit);
      expect(yield* repository.has("rolled-back")).toBe(false);
      yield* repository.enqueue("committed", payload);
      yield* repository.enqueue("committed", payload);
      expect(yield* (yield* Database).query.analyticsJob.findMany()).toHaveLength(1);
    }),
  );

  it.effect(
    "leases once, retries with the same identity, fences stale acknowledgements and clears delivered payloads",
    () =>
      Effect.gen(function* () {
        yield* (yield* TestDatabase).reset;
        const repository = (yield* Repository).jobs.analytics;
        yield* repository.enqueue("delivery", payload);
        const first = yield* repository.claim("first");
        if (!first) return yield* Effect.die("Expected job");
        expect(yield* repository.claim("second")).toBeUndefined();
        yield* TestClock.adjust("2 minutes");
        const reclaimed = yield* repository.claim("second");
        expect(reclaimed?.id).toBe(first.id);
        expect(reclaimed && DateTime.toEpochMillis(reclaimed.createdAt)).toBe(
          DateTime.toEpochMillis(first.createdAt),
        );
        yield* repository.complete(first.id, "first");
        expect((yield* (yield* Database).query.analyticsJob.findFirst())?.deliveredAt).toBeNull();
        yield* repository.retry(first.id, "second", 2);
        expect(yield* repository.claim("third")).toBeUndefined();
        yield* TestClock.adjust("2 minutes");
        expect((yield* repository.claim("third"))?.id).toBe(first.id);
        yield* repository.complete(first.id, "third");
        const delivered = yield* (yield* Database).query.analyticsJob.findFirst();
        expect(delivered?.payload).toBeNull();
        expect(delivered?.deliveredAt).not.toBeNull();
        expect(yield* repository.has("delivery")).toBe(true);
        expect(yield* repository.claim("fourth")).toBeUndefined();
      }),
  );
});
