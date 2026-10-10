import { expect, layer } from "@effect/vitest";
import { Duration, Effect, Ref, Result } from "effect";
import { TestClock } from "effect/testing";

import { Hex } from "@namera-ai/protocol";

import { setupManagedOperations } from "../../fixtures/managed-session-operations.js";
import { sessionCustodyLayer } from "../../fixtures/session-custody.js";

for (const owner of ["passkey", "1claw"] as const) {
  layer(sessionCustodyLayer)(`${owner} owner / managed signatures`, (it) => {
    for (const type of ["message", "typed-data"] as const) {
      it.effect(`verifies ${type}, meters once, and never stores the returned bytes`, () =>
        Effect.gen(function* () {
          const f = yield* setupManagedOperations(owner);
          const request =
            type === "message"
              ? f.signatureRequest
              : {
                  ...f.signatureRequest,
                  payload: {
                    ...f.signatureRequest.payload,
                    type,
                    typedData: {
                      domain: { name: "Namera", version: "1" },
                      types: { Action: [{ name: "value", type: "string" }] },
                      primaryType: "Action",
                      message: { value: "test" },
                    },
                  },
                };
          const prepared = yield* f.client.signature.prepareManaged(request);
          expect(prepared).not.toHaveProperty("signing");
          expect((yield* f.client.signature.prepareManaged(request)).operationId).toBe(
            prepared.operationId,
          );
          const payload = { namespace: "eip155" as const, operationId: prepared.operationId };
          expect(
            yield* f.client.signature
              .complete({ payload: { ...payload, signature: Hex.make(`0x${"11".repeat(65)}`) } })
              .pipe(Effect.flip),
          ).toMatchObject({ code: "SIGNATURE_UNAVAILABLE" });
          const outcomes = yield* Effect.all(
            Array.from({ length: 8 }, () =>
              f.client.signature.completeManaged({ payload }).pipe(Effect.result),
            ),
            { concurrency: 8 },
          );
          const successes = outcomes.filter(Result.isSuccess);
          expect(successes).toHaveLength(1);
          expect(yield* Ref.get(f.control.calls)).toEqual(["signing.signDigest"]);
          const row = yield* f.repository.core.signatureOperation.findByIdForActor(
            prepared.operationId,
            f.organizationId,
            f.apiKey.apiKey.actorId,
          );
          expect(row?.status).toBe("succeeded");
          expect(row?.leaseToken).toBeNull();
          expect(JSON.stringify(row?.data)).not.toContain("0x1234");
          expect(row?.data).not.toHaveProperty("signature");
          expect(
            (yield* f.repository.billing.usageReservation.listBySource(
              f.organizationId,
              "signature-operation",
              prepared.operationId,
            ))[0]?.status,
          ).toBe("settled");
          expect(
            yield* f.client.signature.completeManaged({ payload }).pipe(Effect.flip),
          ).toMatchObject({ code: "SIGNATURE_UNAVAILABLE" });
          expect(yield* f.client.signature.prepareManaged(request).pipe(Effect.flip)).toMatchObject(
            { code: "SIGNATURE_UNAVAILABLE" },
          );
          const fresh = yield* f.client.signature.prepareManaged({
            ...request,
            headers: { "idempotency-key": crypto.randomUUID() },
          });
          expect(fresh.operationId).not.toBe(prepared.operationId);
          yield* f.client.signature.completeManaged({
            payload: { namespace: "eip155", operationId: fresh.operationId },
          });
          expect(
            (yield* f.repository.billing.usageReservation.listBySource(
              f.organizationId,
              "signature-operation",
              fresh.operationId,
            ))[0]?.status,
          ).toBe("settled");
          expect(yield* Ref.get(f.control.calls)).toHaveLength(2);
        }),
      );
    }

    it.effect("requires explicit signature permission before reserving or signing", () =>
      Effect.gen(function* () {
        const f = yield* setupManagedOperations(owner, { allowSignatures: false });
        expect(
          yield* f.client.signature.prepareManaged(f.signatureRequest).pipe(Effect.flip),
        ).toMatchObject({ code: "SIGNATURE_UNAVAILABLE" });
        expect(yield* Ref.get(f.control.calls)).toEqual([]);
      }),
    );

    it.effect("releases expired unsigned attempts and refuses late signing", () =>
      Effect.gen(function* () {
        const f = yield* setupManagedOperations(owner);
        const prepared = yield* f.client.signature.prepareManaged(f.signatureRequest);
        yield* TestClock.adjust(Duration.minutes(6));
        yield* f.app.billing.reconcile();
        expect(
          yield* f.client.signature
            .completeManaged({
              payload: { namespace: "eip155", operationId: prepared.operationId },
            })
            .pipe(Effect.flip),
        ).toMatchObject({ code: "SIGNATURE_UNAVAILABLE" });
        expect(yield* Ref.get(f.control.calls)).toEqual([]);
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
}
