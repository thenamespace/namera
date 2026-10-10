import { expect, layer } from "@effect/vitest";
import { Duration, Effect, Ref, Result } from "effect";
import { TestClock } from "effect/testing";

import { Hex } from "@namera-ai/protocol";

import { setApiKey, setAuthToken } from "../../fixtures/index.js";
import { setupManagedOperations } from "../../fixtures/managed-session-operations.js";
import { sessionCustodyLayer } from "../../fixtures/session-custody.js";

for (const owner of ["passkey", "1claw"] as const) {
  layer(sessionCustodyLayer)(`${owner} owner / managed execution`, (it) => {
    it.effect("signs once with the session, queues and confirms one metered operation", () =>
      Effect.gen(function* () {
        const f = yield* setupManagedOperations(owner);
        expect(
          (yield* f.client.execution.simulate({ payload: f.executionRequest.payload })).allowed,
        ).toBe(true);
        const prepared = yield* f.client.execution.prepareManaged(f.executionRequest);
        expect(prepared).not.toHaveProperty("signing");
        expect((yield* f.client.execution.prepareManaged(f.executionRequest)).submissionId).toBe(
          prepared.submissionId,
        );
        expect(
          yield* f.client.execution.prepare(f.executionRequest).pipe(Effect.flip),
        ).toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
        const payload = { namespace: "eip155" as const, submissionId: prepared.submissionId };
        expect(
          yield* f.client.execution
            .complete({ payload: { ...payload, signature: Hex.make(`0x${"11".repeat(65)}`) } })
            .pipe(Effect.flip),
        ).toMatchObject({ code: "EXECUTION_UNAVAILABLE" });
        const outcomes = yield* Effect.all(
          Array.from({ length: 8 }, () =>
            f.client.execution.completeManaged({ payload }).pipe(Effect.result),
          ),
          { concurrency: 8 },
        );
        expect(outcomes.some(Result.isSuccess)).toBe(true);
        expect(yield* Ref.get(f.control.calls)).toEqual(["signing.signDigest"]);
        expect(yield* f.client.execution.completeManaged({ payload })).toMatchObject({
          status: "prepared",
        });
        yield* TestClock.adjust(Duration.seconds(2));
        yield* f.app.execution.reconcile();
        yield* TestClock.adjust(Duration.seconds(16));
        yield* f.app.execution.reconcile();
        const submission = yield* f.repository.core.executionSubmission.findById(
          prepared.submissionId,
          f.organizationId,
        );
        expect(submission?.status).toBe("confirmed");
        expect(submission?.data.signedExecution).not.toBeNull();
        const holds = yield* f.repository.billing.usageReservation.listBySource(
          f.organizationId,
          "execution-submission",
          prepared.submissionId,
        );
        expect(holds).toHaveLength(1);
        expect(holds[0]?.status).toBe("settled");
        expect(yield* Ref.get(f.control.calls)).toEqual(["signing.signDigest"]);
      }),
    );

    it.effect(
      "fences failed provider calls until lease expiry and retries the same preparation",
      () =>
        Effect.gen(function* () {
          const f = yield* setupManagedOperations(owner);
          const prepared = yield* f.client.execution.prepareManaged(f.executionRequest);
          const payload = { namespace: "eip155" as const, submissionId: prepared.submissionId };
          yield* Ref.set(f.control.failNext, "signing.signDigest");
          expect(
            yield* f.client.execution.completeManaged({ payload }).pipe(Effect.flip),
          ).toMatchObject({ code: "EXECUTION_FAILED" });
          expect(
            yield* f.client.execution.completeManaged({ payload }).pipe(Effect.flip),
          ).toMatchObject({ code: "EXECUTION_UNAVAILABLE" });
          yield* TestClock.adjust(Duration.minutes(2));
          expect(yield* f.client.execution.completeManaged({ payload })).toMatchObject({
            status: "prepared",
            submissionId: prepared.submissionId,
          });
          expect(
            yield* f.repository.billing.usageReservation.listBySource(
              f.organizationId,
              "execution-submission",
              prepared.submissionId,
            ),
          ).toHaveLength(1);
        }),
    );

    it.effect(
      "rejects revoked authority and expires its unsigned reservation without signing",
      () =>
        Effect.gen(function* () {
          const f = yield* setupManagedOperations(owner);
          const prepared = yield* f.client.execution.prepareManaged(f.executionRequest);
          yield* setApiKey();
          yield* setAuthToken(f.actor.cookie.value);
          yield* f.client.sessionKey.revoke({ params: { sessionKeyId: f.session.id } });
          yield* setAuthToken();
          yield* setApiKey(f.apiKey.key);
          yield* f.client.execution
            .completeManaged({
              payload: { namespace: "eip155", submissionId: prepared.submissionId },
            })
            .pipe(Effect.flip);
          expect(yield* Ref.get(f.control.calls)).toEqual([]);
          yield* TestClock.adjust(Duration.minutes(6));
          yield* f.app.execution.reconcile();
          expect(
            (yield* f.repository.core.executionSubmission.findById(
              prepared.submissionId,
              f.organizationId,
            ))?.status,
          ).toBe("failed");
          expect(
            (yield* f.repository.billing.usageReservation.listBySource(
              f.organizationId,
              "execution-submission",
              prepared.submissionId,
            ))[0]?.status,
          ).toBe("released");
        }),
    );
  });
}
