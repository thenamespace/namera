import { expect, layer } from "@effect/vitest";
import { DateTime, Effect, Layer } from "effect";

import type { ExecutionSubmissionInsert } from "@namera-ai/protocol/model";

import { Repository, TestDatabase } from "../../../src/index.js";
import { sessionOperationFixture } from "../../fixtures/session-operation.js";

const Persistence = Repository.layer.pipe(Layer.provideMerge(TestDatabase.layer));

const fixture = Effect.fn("test.executionSigning.fixture")(function* (name: string) {
  const owner = yield* sessionOperationFixture(name);
  const repository = yield* Repository;
  const [grant] = yield* repository.core.sessionKeyGrant.insertMany([
    {
      organizationId: owner.organization.id,
      actorId: owner.actor.id,
      sessionKeyId: owner.installation.sessionKeyId,
      grantedByActorId: owner.actor.id,
    },
  ]);
  if (grant === undefined) return yield* Effect.die("Expected fixture grant");
  const input: ExecutionSubmissionInsert = {
    organizationId: owner.organization.id,
    actorId: owner.actor.id,
    sessionKeyGrantId: grant.id,
    sessionKeyId: owner.installation.sessionKeyId,
    installationId: owner.installation.id,
    expiresAt: DateTime.fromEpochSeconds(100),
    idempotencyKey: name,
    requestHash: name,
    policyHash: "fixture",
    namespace: "eip155",
    data: {
      version: 1,
      chainId: owner.installation.chainId,
      calls: owner.input.data.prepared.context.calls,
      prepared: owner.input.data.prepared,
      signedExecution: null,
    },
  };
  return { ...owner, input };
});

layer(Persistence)("local execution persistence", (it) => {
  it.effect("fences managed signing by actor, deadline and the latest lease token", () =>
    Effect.gen(function* () {
      yield* (yield* TestDatabase).reset;
      const repository = (yield* Repository).core.executionSubmission;
      const owner = yield* fixture("managed-execution-lease");
      const other = yield* fixture("other-managed-execution");
      const { submission } = yield* repository.insert({
        ...owner.input,
        data: { ...owner.input.data, managedSignerBinding: "test-public-binding" },
      });
      const claim = {
        id: submission.id,
        organizationId: owner.organization.id,
        actorId: owner.actor.id,
        leaseToken: "first",
        now: DateTime.fromEpochSeconds(1),
        leaseExpiresAt: DateTime.fromEpochSeconds(20),
      };
      expect(
        yield* repository.claimForSigning({ ...claim, actorId: other.actor.id }),
      ).toBeUndefined();
      expect(
        yield* repository.claimForSigning({ ...claim, organizationId: other.organization.id }),
      ).toBeUndefined();
      expect(yield* repository.claimForSigning(claim)).toBeDefined();
      expect(yield* repository.claimForSigning({ ...claim, leaseToken: "second" })).toBeUndefined();
      const acceptance = {
        id: submission.id,
        organizationId: owner.organization.id,
        actorId: owner.actor.id,
        requestHash: owner.input.requestHash,
        signed: owner.signed,
        now: DateTime.fromEpochSeconds(21),
        nextReconcileAt: DateTime.fromEpochSeconds(40),
      };
      expect(yield* repository.acceptSignature(acceptance)).toBeUndefined();
      expect(
        yield* repository.acceptSignature({ ...acceptance, leaseToken: "first" }),
      ).toBeUndefined();
      expect(
        yield* repository.claimForSigning({
          ...claim,
          now: acceptance.now,
          leaseToken: "second",
          leaseExpiresAt: DateTime.fromEpochSeconds(35),
        }),
      ).toBeDefined();
      expect(
        yield* repository.acceptSignature({ ...acceptance, leaseToken: "first" }),
      ).toBeUndefined();
      expect(
        (yield* repository.acceptSignature({ ...acceptance, leaseToken: "second" }))?.status,
      ).toBe("prepared");
      expect(
        yield* repository.claimForSigning({ ...claim, now: DateTime.fromEpochSeconds(50) }),
      ).toBeUndefined();
    }),
  );
  it.effect("leases abandoned unsigned preparations only after their signing deadline", () =>
    Effect.gen(function* () {
      yield* (yield* TestDatabase).reset;
      const repository = (yield* Repository).core.executionSubmission;
      const owner = yield* fixture("execution-expiry");
      const { submission } = yield* repository.insert(owner.input);
      const claim = {
        now: DateTime.fromEpochSeconds(99),
        leaseToken: "expiry-worker",
        leaseExpiresAt: DateTime.fromEpochSeconds(120),
        limit: 10,
      };
      expect(yield* repository.claimForReconciliation(claim)).toHaveLength(0);
      const claimed = yield* repository.claimForReconciliation({
        ...claim,
        now: submission.expiresAt,
      });
      expect(claimed.map((row) => row.id)).toEqual([submission.id]);
      expect(claimed[0]?.status).toBe("reserved");
      expect(
        yield* repository.claimForReconciliation({
          ...claim,
          now: submission.expiresAt,
          leaseToken: "other-worker",
        }),
      ).toHaveLength(0);
    }),
  );
  it.effect("accepts a signature once before expiry without replacing the preparation", () =>
    Effect.gen(function* () {
      yield* (yield* TestDatabase).reset;
      const repository = (yield* Repository).core.executionSubmission;
      const owner = yield* fixture("execution-signing-owner");
      const other = yield* fixture("execution-signing-other");
      const { submission } = yield* repository.insert(owner.input);
      const acceptance = {
        id: submission.id,
        organizationId: owner.organization.id,
        actorId: owner.actor.id,
        requestHash: owner.input.requestHash,
        signed: owner.signed,
        now: DateTime.fromEpochSeconds(99),
        nextReconcileAt: DateTime.fromEpochSeconds(110),
      };
      expect(
        yield* repository.acceptSignature({ ...acceptance, organizationId: other.organization.id }),
      ).toBeUndefined();
      expect(
        yield* repository.acceptSignature({ ...acceptance, actorId: other.actor.id }),
      ).toBeUndefined();
      expect(
        yield* repository.acceptSignature({ ...acceptance, requestHash: "different-request" }),
      ).toBeUndefined();
      expect(
        yield* repository.acceptSignature({ ...acceptance, now: submission.expiresAt }),
      ).toBeUndefined();
      const accepted = yield* repository.acceptSignature(acceptance);
      expect(accepted?.status).toBe("prepared");
      expect(accepted?.data.prepared).toEqual(submission.data.prepared);
      expect(accepted?.data.signedExecution).toEqual(owner.signed);
      expect(yield* repository.acceptSignature(acceptance)).toBeUndefined();
      const replay = yield* repository.insert(owner.input);
      expect(replay.inserted).toBe(false);
      expect(replay.submission.id).toBe(submission.id);
      expect(replay.submission.data.signedExecution).toEqual(owner.signed);

      yield* repository.claimForReconciliation({
        now: DateTime.fromEpochSeconds(110),
        leaseToken: "broadcast-worker",
        leaseExpiresAt: DateTime.fromEpochSeconds(130),
        limit: 1,
      });
      const attempt = {
        id: submission.id,
        organizationId: owner.organization.id,
        leaseToken: "broadcast-worker",
        now: DateTime.fromEpochSeconds(111),
      };
      for (const invalid of [
        { ...attempt, organizationId: other.organization.id },
        { ...attempt, leaseToken: "stale-worker" },
        { ...attempt, now: DateTime.fromEpochSeconds(130) },
      ])
        expect(yield* repository.recordBroadcastAttempt(invalid)).toBeUndefined();
      const started = yield* repository.recordBroadcastAttempt(attempt);
      expect(started?.data.broadcastAttempted).toBe(true);
      expect(started?.data.signedExecution).toEqual(owner.signed);
      expect(started?.data.prepared).toEqual(submission.data.prepared);
    }),
  );

  it.effect(
    "requires the grant and installation to belong to the selected session and tenant",
    () =>
      Effect.gen(function* () {
        yield* (yield* TestDatabase).reset;
        const repository = (yield* Repository).core.executionSubmission;
        const owner = yield* fixture("execution-binding-owner");
        const other = yield* fixture("execution-binding-other");
        for (const input of [
          { ...owner.input, sessionKeyId: other.installation.sessionKeyId },
          { ...owner.input, installationId: other.installation.id },
          { ...owner.input, sessionKeyGrantId: other.input.sessionKeyGrantId },
        ]) {
          const rejected = yield* repository.insert(input).pipe(
            Effect.as(false),
            Effect.catchTag("DatabaseError", () => Effect.succeed(true)),
          );
          expect(rejected).toBe(true);
        }
        expect((yield* repository.insert(owner.input)).inserted).toBe(true);
      }),
  );
});
