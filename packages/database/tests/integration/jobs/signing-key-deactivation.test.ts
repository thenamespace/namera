import { expect, layer } from "@effect/vitest";
import { DateTime, Effect, Layer } from "effect";

import { Repository, TestDatabase, TransactionService } from "../../../src/index.js";
import { DatabaseTestLayer } from "../../fixtures/database.js";
import { installationFixture } from "../../fixtures/session-installation.js";

const Persistence = Layer.mergeAll(Repository.layer, TransactionService.layer).pipe(
  Layer.provideMerge(DatabaseTestLayer),
);

const setup = Effect.gen(function* () {
  yield* (yield* TestDatabase).reset;
  const repository = yield* Repository;
  const owner = yield* installationFixture("deactivation-owner");
  const session = yield* repository.core.sessionKey.findById(
    owner.input.sessionKeyId,
    owner.organization.id,
  );
  if (!session) return yield* Effect.die("Missing fixture session");
  return {
    jobs: repository.jobs.signingKeyDeactivation,
    scope: { organizationId: owner.organization.id, signingKeyId: session.signingKeyId },
  };
});

layer(Persistence)("signing-key deactivation jobs", (it) => {
  it.effect("deduplicates jobs, enforces tenant ownership and joins the business transaction", () =>
    Effect.gen(function* () {
      const { jobs, scope } = yield* setup;
      const transaction = yield* TransactionService;
      const error = yield* transaction
        .run(
          Effect.gen(function* () {
            yield* jobs.enqueue(scope);
            expect(yield* jobs.findForSigner(scope)).toBeDefined();
            return yield* Effect.fail("rollback");
          }),
        )
        .pipe(Effect.flip);
      expect(error).toBe("rollback");
      expect(yield* jobs.findForSigner(scope)).toBeUndefined();
      const job = yield* jobs.enqueue(scope);
      expect(job).toMatchObject({ status: "pending", attempts: 0 });
      expect(yield* jobs.enqueue(scope)).toBeUndefined();
      expect((yield* jobs.findForSigner(scope))?.id).toBe(job?.id);

      const other = yield* installationFixture("deactivation-other");
      const foreign = { ...scope, organizationId: other.organization.id };
      expect(yield* jobs.findForSigner(foreign)).toBeUndefined();
      expect(yield* jobs.enqueue(foreign).pipe(Effect.flip)).toMatchObject({
        _tag: "DatabaseError",
      });
    }),
  );

  it.effect("recovers expired leases and rejects stale workers and early retries", () =>
    Effect.gen(function* () {
      const { jobs, scope } = yield* setup;
      yield* jobs.enqueue(scope);
      const now = yield* DateTime.now;
      const first = yield* jobs.claim({
        now,
        leaseToken: "first",
        leaseExpiresAt: DateTime.add(now, { minutes: 3 }),
      });
      if (!first) return yield* Effect.die("Missing claimed job");
      expect(first.attempts).toBe(1);
      expect(
        yield* jobs.claim({
          now,
          leaseToken: "second",
          leaseExpiresAt: DateTime.add(now, { minutes: 3 }),
        }),
      ).toBeUndefined();
      const later = DateTime.add(now, { minutes: 4 });
      const lease = {
        id: first.id,
        organizationId: scope.organizationId,
        leaseToken: "first",
        now: later,
      };
      expect(yield* jobs.complete(lease)).toBeUndefined();
      expect(
        yield* jobs.claim({
          now: later,
          leaseToken: "second",
          leaseExpiresAt: DateTime.add(later, { minutes: 3 }),
        }),
      ).toMatchObject({ id: first.id, attempts: 2 });
      expect(yield* jobs.complete(lease)).toBeUndefined();
      expect(
        yield* jobs.fail({
          ...lease,
          status: "needs-attention",
          availableAt: later,
          lastErrorCode: "KEY_MISMATCH",
        }),
      ).toBeUndefined();
      const retryAt = DateTime.add(later, { seconds: 30 });
      expect(
        yield* jobs.fail({
          ...lease,
          leaseToken: "second",
          status: "pending",
          availableAt: retryAt,
          lastErrorCode: "TIMEOUT",
        }),
      ).toMatchObject({ status: "pending", leaseToken: null, lastErrorCode: "TIMEOUT" });
      expect(
        yield* jobs.claim({
          now: later,
          leaseToken: "third",
          leaseExpiresAt: DateTime.add(later, { minutes: 3 }),
        }),
      ).toBeUndefined();
      yield* jobs.claim({
        now: retryAt,
        leaseToken: "third",
        leaseExpiresAt: DateTime.add(retryAt, { minutes: 3 }),
      });
      expect(yield* jobs.complete({ ...lease, now: retryAt, leaseToken: "third" })).toMatchObject({
        status: "completed",
        attempts: 3,
        lastErrorCode: null,
        leaseToken: null,
      });
      expect(
        yield* jobs.claim({
          now: retryAt,
          leaseToken: "fourth",
          leaseExpiresAt: DateTime.add(retryAt, { minutes: 3 }),
        }),
      ).toBeUndefined();
    }),
  );

  it.effect("only one concurrent worker claims a due job", () =>
    Effect.gen(function* () {
      const { jobs, scope } = yield* setup;
      yield* jobs.enqueue(scope);
      const now = yield* DateTime.now;
      const claims = yield* Effect.forEach(
        ["first", "second", "third"],
        (leaseToken) =>
          jobs.claim({ now, leaseToken, leaseExpiresAt: DateTime.add(now, { minutes: 3 }) }),
        { concurrency: "unbounded" },
      );
      expect(claims.filter((job) => job !== undefined)).toHaveLength(1);
      expect((yield* jobs.findForSigner(scope))?.attempts).toBe(1);
    }),
  );
});
