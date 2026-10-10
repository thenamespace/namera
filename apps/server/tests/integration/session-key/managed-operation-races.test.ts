import { expect, layer } from "@effect/vitest";
import { DateTime, Deferred, Duration, Effect, Fiber, Ref } from "effect";
import { TestClock } from "effect/testing";

import { setApiKey, setAuthToken } from "../../fixtures/index.js";
import { setupManagedOperations } from "../../fixtures/managed-session-operations.js";
import { makeSessionCustodyLayer } from "../../fixtures/session-custody.js";

for (const kind of ["execution", "signature"] as const) {
  for (const mutation of ["revoke", "disable-key", "disable-connection"] as const) {
    const started = Deferred.makeUnsafe<void>();
    layer(
      makeSessionCustodyLayer(
        "10 seconds",
        Deferred.succeed(started, undefined).pipe(Effect.asVoid),
      ),
    )(`managed ${kind} ${mutation} race`, (it) => {
      it.effect(`rejects ${mutation} committed while verification is in flight`, () =>
        Effect.gen(function* () {
          const f = yield* setupManagedOperations("1claw");
          const completion =
            kind === "execution"
              ? f.client.execution.prepare(f.executionRequest).pipe(
                  Effect.flatMap((prepared) =>
                    f.client.execution.complete({
                      payload: { namespace: "eip155", submissionId: prepared.submissionId },
                    }),
                  ),
                  Effect.asVoid,
                  Effect.mapError((error) =>
                    "code" in error ? String(error.code) : "unexpected-error",
                  ),
                )
              : f.client.signature.prepare(f.signatureRequest).pipe(
                  Effect.flatMap((prepared) =>
                    f.client.signature.complete({
                      payload: { namespace: "eip155", operationId: prepared.operationId },
                    }),
                  ),
                  Effect.asVoid,
                  Effect.mapError((error) =>
                    "code" in error ? String(error.code) : "unexpected-error",
                  ),
                );
          const fiber = yield* completion.pipe(Effect.flip, Effect.forkChild);
          yield* Deferred.await(started);
          yield* TestClock.adjust(Duration.seconds(1));
          expect(yield* Ref.get(f.control.calls)).toEqual(["signing.signDigest"]);
          expect(fiber.pollUnsafe()).toBeUndefined();
          if (mutation === "revoke") {
            yield* setApiKey();
            yield* setAuthToken(f.actor.cookie.value);
            yield* f.client.sessionKey.revoke({ params: { sessionKeyId: f.session.id } });
          } else if (mutation === "disable-key") {
            yield* f.repository.core.signingKey.setStatus(
              f.session.signingKeyId,
              f.organizationId,
              "disabled",
            );
          } else {
            const key = yield* f.repository.core.signingKey.findById(
              f.session.signingKeyId,
              f.organizationId,
            );
            if (!key?.providerConnectionId) return yield* Effect.die("Missing managed connection");
            yield* f.repository.core.providerConnections.disable({
              id: key.providerConnectionId,
              organizationId: f.organizationId,
            });
          }
          yield* TestClock.adjust(Duration.seconds(10));
          expect(yield* Fiber.join(fiber)).toBe(
            mutation === "revoke"
              ? "NO_AUTHORIZED_SESSION_KEY"
              : kind === "execution"
                ? "EXECUTION_UNAVAILABLE"
                : "SIGNATURE_UNAVAILABLE",
          );
        }),
      );
    });
  }
}

const verificationStarted = Deferred.makeUnsafe<void>();
layer(
  makeSessionCustodyLayer(
    "3 minutes",
    Deferred.succeed(verificationStarted, undefined).pipe(Effect.asVoid),
  ),
)("managed signature signing lease", (it) => {
  it.effect("fences a stale result after a replacement claim without persisting bytes", () =>
    Effect.gen(function* () {
      const f = yield* setupManagedOperations("passkey");
      const prepared = yield* f.client.signature.prepare(f.signatureRequest);
      const fiber = yield* f.client.signature
        .complete({ payload: { namespace: "eip155", operationId: prepared.operationId } })
        .pipe(Effect.flip, Effect.forkChild);
      yield* Deferred.await(verificationStarted);
      yield* TestClock.adjust(Duration.minutes(2));
      const now = yield* DateTime.now;
      const replacement = yield* f.repository.core.signatureOperation.claimForSigning({
        id: prepared.operationId,
        organizationId: f.organizationId,
        actorId: f.apiKey.apiKey.actorId,
        leaseToken: "replacement-attempt",
        now,
        leaseExpiresAt: DateTime.addDuration(now, Duration.minutes(2)),
      });
      expect(replacement).toBeDefined();
      yield* TestClock.adjust(Duration.minutes(1));
      expect(yield* Fiber.join(fiber)).toMatchObject({ code: "SIGNATURE_UNAVAILABLE" });
      expect(
        (yield* f.repository.core.signatureOperation.findByIdForActor(
          prepared.operationId,
          f.organizationId,
          f.apiKey.apiKey.actorId,
        ))?.status,
      ).toBe("reserved");
      expect(
        (yield* f.repository.billing.usageReservation.listBySource(
          f.organizationId,
          "signature-operation",
          prepared.operationId,
        ))[0]?.status,
      ).toBe("active");
      yield* TestClock.adjust(Duration.minutes(3));
      yield* f.app.billing.reconcile();
      expect(
        (yield* f.repository.billing.usageReservation.listBySource(
          f.organizationId,
          "signature-operation",
          prepared.operationId,
        ))[0]?.status,
      ).toBe("expired");
    }),
  );
});
