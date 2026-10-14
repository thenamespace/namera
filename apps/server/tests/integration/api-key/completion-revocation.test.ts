import { expect, layer } from "@effect/vitest";
import { Deferred, Duration, Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";

import { NameraApi } from "@namera-ai/api";

import { handledApi } from "../../fixtures/http-api-test.js";
import { setupManagedOperations } from "../../fixtures/managed-session-operations.js";
import { makeSessionCustodyLayer, sessionCustodyLayer } from "../../fixtures/session-custody.js";

for (const kind of ["execution", "signature"] as const) {
  const verifying = Deferred.makeUnsafe<void>();
  layer(
    makeSessionCustodyLayer(
      "10 seconds",
      Deferred.succeed(verifying, undefined).pipe(Effect.asVoid),
    ),
  )(`API-key revocation during ${kind} completion`, (it) => {
    it.effect("rejects completion when revocation commits during provider verification", () =>
      Effect.gen(function* () {
        const f = yield* setupManagedOperations("1claw");
        const owner = yield* handledApi(NameraApi, {
          headers: {
            cookie: `auth-token=${f.actor.cookie.value}`,
            origin: "http://dashboard.test",
          },
        });
        const prepared =
          kind === "execution"
            ? yield* f.client.execution.prepare(f.executionRequest)
            : yield* f.client.signature.prepare(f.signatureRequest);
        const complete =
          "submissionId" in prepared
            ? f.client.execution
                .complete({ payload: { namespace: "eip155", submissionId: prepared.submissionId } })
                .pipe(Effect.asVoid, Effect.result)
            : f.client.signature
                .complete({ payload: { namespace: "eip155", operationId: prepared.operationId } })
                .pipe(Effect.asVoid, Effect.result);
        const fiber = yield* Effect.forkChild(complete);
        yield* Deferred.await(verifying);
        yield* owner.apiKey.revoke({ params: { apiKeyId: f.apiKey.apiKey.id } });
        yield* TestClock.adjust(Duration.seconds(10));
        expect(yield* Fiber.join(fiber)).toMatchObject({
          _tag: "Failure",
          failure: { code: "NO_AUTHORIZED_SESSION_KEY" },
        });
        expect(
          yield* f.repository.core.sessionKeyGrant.findActiveForActor(
            f.organizationId,
            f.apiKey.apiKey.actorId,
          ),
        ).toEqual([]);
        if ("submissionId" in prepared) {
          const stored = yield* f.repository.core.executionSubmission.findById(
            prepared.submissionId,
            f.organizationId,
          );
          expect(stored?.status).toBe("reserved");
          expect(stored?.data.signedExecution).toBeNull();
        }
      }),
    );
  });
}

layer(sessionCustodyLayer)("API-key lifetime after execution acceptance", (it) => {
  it.effect("retains signed work and its reservation after credential revocation", () =>
    Effect.gen(function* () {
      const f = yield* setupManagedOperations("1claw");
      const owner = yield* handledApi(NameraApi, {
        headers: { cookie: `auth-token=${f.actor.cookie.value}`, origin: "http://dashboard.test" },
      });
      const prepared = yield* f.client.execution.prepare(f.executionRequest);
      yield* f.client.execution.complete({
        payload: { namespace: "eip155", submissionId: prepared.submissionId },
      });
      yield* owner.apiKey.revoke({ params: { apiKeyId: f.apiKey.apiKey.id } });
      expect(yield* f.client.execution.prepare(f.executionRequest).pipe(Effect.flip)).toMatchObject(
        { _tag: "Unauthorized" },
      );
      const holds = () =>
        f.repository.billing.usageReservation.listBySource(
          f.organizationId,
          "execution-submission",
          prepared.submissionId,
        );
      expect((yield* holds()).map((hold) => hold.status)).toEqual(["active"]);
      yield* TestClock.adjust(Duration.seconds(2));
      yield* f.app.execution.reconcile();
      yield* TestClock.adjust(Duration.seconds(16));
      yield* f.app.execution.reconcile();
      expect(
        (yield* f.repository.core.executionSubmission.findById(
          prepared.submissionId,
          f.organizationId,
        ))?.status,
      ).toBe("confirmed");
      expect((yield* holds()).map((hold) => hold.status)).toEqual(["settled"]);
    }),
  );

  it.effect("rejects an expired credential at the HTTP boundary", () =>
    Effect.gen(function* () {
      const f = yield* setupManagedOperations("1claw");
      yield* TestClock.adjust(Duration.days(1));
      expect(yield* f.client.wallet.list().pipe(Effect.flip)).toMatchObject({
        _tag: "Unauthorized",
      });
    }),
  );
});
