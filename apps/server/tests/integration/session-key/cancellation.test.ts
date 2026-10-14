import { expect, layer } from "@effect/vitest";
import { Duration, Effect, Exit } from "effect";
import { TestClock } from "effect/testing";

import { Application } from "@namera-ai/application";
import { TestEvmExecution } from "@namera-ai/evm";

import {
  prepareCustodyOperation,
  sessionCustodyLayer,
  setupSessionCustody,
} from "../../fixtures/session-custody.js";

for (const owner of ["passkey", "1claw"] as const) {
  layer(sessionCustodyLayer)(`${owner} session operation cancellation`, (it) => {
    it.effect("cancels once without installing permissions or reactivating a revoked session", () =>
      Effect.gen(function* () {
        const f = yield* setupSessionCustody(owner, "local");
        const installation = f.session.installations[0];
        if (!installation) return yield* Effect.die("Missing installation");
        const request = {
          installationId: installation.id,
          kind: "install" as const,
          sponsor: false,
          idempotencyKey: crypto.randomUUID(),
        };
        const operation = yield* prepareCustodyOperation(f.client, owner, request);
        const params = { operationId: operation.prepared.operationId };
        for (let i = 0; i < 2; i++)
          expect((yield* f.client.sessionKey.cancelOperation({ params })).status).toBe("cancelled");
        expect(Exit.isFailure(yield* operation.approve.pipe(Effect.exit))).toBe(true);
        expect(
          yield* f.repository.billing.usageReservation.listBySource(
            f.organizationId,
            "session-key-operation",
            params.operationId,
          ),
        ).toHaveLength(0);
        const next = yield* prepareCustodyOperation(f.client, owner, {
          ...request,
          idempotencyKey: crypto.randomUUID(),
        });
        yield* next.approve;
        yield* (yield* TestEvmExecution).setReceiptMode("immediate");
        yield* TestClock.adjust(Duration.seconds(2));
        yield* (yield* Application).sessionKey.reconcileOperations();
        yield* f.client.sessionKey.revoke({ params: { sessionKeyId: f.session.id } });
        const before = yield* f.client.sessionKey.get({ params: { sessionKeyId: f.session.id } });
        const removal = yield* prepareCustodyOperation(f.client, owner, {
          ...request,
          kind: "uninstall",
          idempotencyKey: crypto.randomUUID(),
        });
        yield* f.client.sessionKey.cancelOperation({
          params: { operationId: removal.prepared.operationId },
        });
        expect(
          (yield* f.client.sessionKey.get({ params: { sessionKeyId: f.session.id } })).status,
        ).toBe(before.status);
        expect(before.status).toBe("revoking");
        expect(Exit.isFailure(yield* removal.approve.pipe(Effect.exit))).toBe(true);
      }),
    );

    it.effect("serializes approval against cancellation and keeps signed/pending holds", () =>
      Effect.gen(function* () {
        const f = yield* setupSessionCustody(owner, "local");
        const installation = f.session.installations[0];
        if (!installation) return yield* Effect.die("Missing installation");
        const operation = yield* prepareCustodyOperation(f.client, owner, {
          installationId: installation.id,
          kind: "install",
          sponsor: false,
          idempotencyKey: crypto.randomUUID(),
        });
        const params = { operationId: operation.prepared.operationId };
        const results = yield* Effect.all(
          [
            operation.approve.pipe(Effect.exit),
            f.client.sessionKey.cancelOperation({ params }).pipe(Effect.exit),
          ],
          { concurrency: 2 },
        );
        expect(results.filter(Exit.isSuccess)).toHaveLength(1);
        const status = (yield* f.client.sessionKey.getOperation({ params })).status;
        expect(["signed", "cancelled"]).toContain(status);
        const holds = f.repository.billing.usageReservation.listBySource(
          f.organizationId,
          "session-key-operation",
          params.operationId,
        );
        if (status === "cancelled") expect(yield* holds).toHaveLength(0);
        else {
          expect((yield* holds).map((hold) => hold.status)).toEqual(["active"]);
          yield* (yield* TestEvmExecution).setReceiptMode("missing");
          yield* TestClock.adjust(Duration.seconds(2));
          yield* (yield* Application).sessionKey.reconcileOperations();
          expect(
            yield* f.client.sessionKey.cancelOperation({ params }).pipe(Effect.flip),
          ).toMatchObject({ code: "OPERATION_UNAVAILABLE" });
          expect((yield* holds).map((hold) => hold.status)).toEqual(["active"]);
        }
      }),
    );
  });
}
