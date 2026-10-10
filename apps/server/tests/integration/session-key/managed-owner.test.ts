import { expect, layer } from "@effect/vitest";
import { DateTime, Duration, Effect, Ref, Result, Schema } from "effect";
import { TestClock } from "effect/testing";

import { Application, makeBillingMetering } from "@namera-ai/application";
import { Database, organizationMember, sessionKeyOperation } from "@namera-ai/database";
import { TestEvmExecution } from "@namera-ai/evm";
import { Hex } from "@namera-ai/protocol";
import { SessionKeyOperationData } from "@namera-ai/protocol/model";

import { createMember, setApiKey, setAuthToken, signIn, testEmail } from "../../fixtures/index.js";
import { TestAuthToken } from "../../fixtures/layers/index.js";
import { managedSessionLayer, setupManagedSession } from "../../fixtures/managed-session.js";

layer(managedSessionLayer())("1Claw session owner approval", (it) => {
  it.effect("signs once, recovers receipts, executes locally and removes the session", () =>
    Effect.gen(function* () {
      const {
        client,
        wallet,
        session,
        request,
        prepared,
        control,
        repository,
        organizationId,
        actor,
      } = yield* setupManagedSession;
      expect(yield* Ref.get(control.calls)).toEqual([]);
      expect(prepared.approval).toBe("1claw");
      expect(prepared).not.toHaveProperty("options");
      expect((yield* client.sessionKey.prepareManagedOperation(request)).operationId).toBe(
        prepared.operationId,
      );
      expect(yield* client.sessionKey.prepareOperation(request).pipe(Effect.flip)).toMatchObject({
        code: "OWNER_UNAVAILABLE",
      });
      const approval = { payload: { operationId: prepared.operationId } };
      expect(yield* client.sessionKey.approveManagedOperation(approval)).toMatchObject({
        status: "signed",
      });
      expect(yield* client.sessionKey.approveManagedOperation(approval)).toMatchObject({
        status: "signed",
      });
      expect(yield* Ref.get(control.calls)).toEqual(["signing.signDigest"]);
      const stored = yield* repository.core.sessionKeyOperation.findById({
        id: prepared.operationId,
        organizationId,
      });
      if (
        !stored?.data.signed ||
        wallet.data.validatorType !== "ecdsa_secp256k1" ||
        wallet.data.accountMode !== "factory"
      )
        return yield* Effect.die("Missing managed signed operation");
      // The real owner adapter recovers this provider signature against the stored public key.
      expect(stored.data.signed.userOperation.signature).toMatch(/^0x[0-9a-f]{130}$/);
      expect((yield* client.sessionKey.get({ params: { sessionKeyId: session.id } })).status).toBe(
        "pending",
      );
      const app = yield* Application;
      const execution = yield* TestEvmExecution;
      yield* execution.setReceiptMode("missing");
      yield* TestClock.adjust(Duration.seconds(2));
      yield* app.sessionKey.reconcileOperations();
      expect((yield* client.sessionKey.getOperation({ params: approval.payload })).status).toBe(
        "submitted",
      );
      yield* execution.setReceiptMode("immediate");
      yield* TestClock.adjust(Duration.seconds(16));
      yield* app.sessionKey.reconcileOperations();
      expect((yield* client.sessionKey.get({ params: { sessionKeyId: session.id } })).status).toBe(
        "active",
      );
      const holds = yield* repository.billing.usageReservation.listBySource(
        organizationId,
        "session-key-operation",
        prepared.operationId,
      );
      expect(holds).toHaveLength(1);
      expect(holds[0]?.status).toBe("settled");
      expect(
        (yield* repository.audit.organization.findForOrganization(organizationId)).filter(
          ({ event }) => event === "session_key.operation_approved",
        ),
      ).toHaveLength(1);

      const apiKey = yield* client.apiKey.create({
        payload: {
          metadata: { version: 1, name: "Local agent" },
          durationDays: 1,
          sessionKeyIds: [session.id],
        },
      });
      yield* setApiKey(apiKey.key);
      const payload = {
        namespace: "eip155" as const,
        walletId: wallet.id,
        sessionKeyId: session.id,
        chainId: "eip155:11155111" as const,
        calls: [{ to: wallet.address, value: 0n, data: Hex.make("0x") }],
        sponsor: false,
      };
      expect((yield* client.execution.simulate({ payload })).allowed).toBe(true);
      yield* client.execution.prepare({
        headers: { "idempotency-key": crypto.randomUUID() },
        payload,
      });
      expect(yield* Ref.get(control.calls)).toEqual(["signing.signDigest"]);
      expect(
        yield* client.sessionKey.approveManagedOperation(approval).pipe(Effect.result),
      ).toMatchObject({ _tag: "Failure" });
      yield* (yield* TestAuthToken).clearApiKey;
      yield* setAuthToken(actor.cookie.value);
      const revoking = yield* client.sessionKey.revoke({ params: { sessionKeyId: session.id } });
      expect(revoking.status).toBe("revoking");
      const removal = yield* client.sessionKey.prepareManagedOperation({
        payload: { ...request.payload, kind: "uninstall", idempotencyKey: crypto.randomUUID() },
      });
      yield* client.sessionKey.approveManagedOperation({
        payload: { operationId: removal.operationId },
      });
      yield* TestClock.adjust(Duration.seconds(2));
      yield* app.sessionKey.reconcileOperations();
      expect((yield* client.sessionKey.get({ params: { sessionKeyId: session.id } })).status).toBe(
        "revoked",
      );
      expect(yield* Ref.get(control.calls)).toEqual(["signing.signDigest", "signing.signDigest"]);
    }),
  );

  it.effect("releases a failed signing lease and retries without duplicate billing", () =>
    Effect.gen(function* () {
      const { client, prepared, control, repository, organizationId } = yield* setupManagedSession;
      const approval = { payload: { operationId: prepared.operationId } };
      yield* Ref.set(control.failNext, "signing.signDigest");
      expect(
        yield* client.sessionKey.approveManagedOperation(approval).pipe(Effect.flip),
      ).toMatchObject({ code: "APPROVAL_INVALID" });
      const scope = { id: prepared.operationId, organizationId };
      expect(yield* repository.core.sessionKeyOperation.findById(scope)).toMatchObject({
        status: "awaiting-signature",
        leaseToken: null,
        data: { signed: null },
      });
      expect(
        yield* repository.billing.usageReservation.listBySource(
          organizationId,
          "session-key-operation",
          prepared.operationId,
        ),
      ).toEqual([]);
      yield* client.sessionKey.approveManagedOperation(approval);
      expect(
        yield* repository.billing.usageReservation.listBySource(
          organizationId,
          "session-key-operation",
          prepared.operationId,
        ),
      ).toHaveLength(1);
    }),
  );

  it.effect("rolls back acceptance and audit when billing admission fails", () =>
    Effect.gen(function* () {
      const { client, prepared, repository, organizationId } = yield* setupManagedSession;
      const metering = yield* makeBillingMetering;
      const full = yield* metering.reserve({
        organizationId,
        meterKey: "execution.testnet",
        amount: 500n,
        sourceType: "manual-adjustment",
        sourceId: crypto.randomUUID(),
        expiresAt: DateTime.add(yield* DateTime.now, { hours: 1 }),
      });
      const approval = { payload: { operationId: prepared.operationId } };
      expect(
        yield* client.sessionKey.approveManagedOperation(approval).pipe(Effect.flip),
      ).toMatchObject({ code: "LIMIT_EXCEEDED" });
      expect(
        yield* repository.core.sessionKeyOperation.findById({
          id: prepared.operationId,
          organizationId,
        }),
      ).toMatchObject({
        status: "awaiting-signature",
        leaseToken: null,
        data: { signed: null },
      });
      expect(
        (yield* repository.audit.organization.findForOrganization(organizationId)).filter(
          ({ event }) => event === "session_key.operation_approved",
        ),
      ).toEqual([]);
      yield* metering.release({ organizationId, reservationId: full.id });
      expect(yield* client.sessionKey.approveManagedOperation(approval)).toMatchObject({
        status: "signed",
      });
    }),
  );

  it.effect("rejects expiry and disabled provider connections before signing", () =>
    Effect.gen(function* () {
      const { client, prepared, control, repository, organizationId } = yield* setupManagedSession;
      const connection = yield* repository.core.providerConnections.findByOrganization(
        organizationId,
        "test-app",
      );
      if (!connection) return yield* Effect.die("Missing connection");
      yield* repository.core.providerConnections.disable({ id: connection.id, organizationId });
      const approval = { payload: { operationId: prepared.operationId } };
      expect(
        yield* client.sessionKey.approveManagedOperation(approval).pipe(Effect.flip),
      ).toMatchObject({ code: "OWNER_UNAVAILABLE" });
      yield* TestClock.adjust(Duration.minutes(6));
      expect(
        yield* client.sessionKey.approveManagedOperation(approval).pipe(Effect.flip),
      ).toMatchObject({ code: "APPROVAL_EXPIRED" });
      expect(yield* Ref.get(control.calls)).toEqual([]);
    }),
  );

  it.effect("rejects another actor/tenant and revoked or expired authority without signing", () =>
    Effect.gen(function* () {
      const { client, actor, session, prepared, control, repository, organizationId } =
        yield* setupManagedSession;
      const approval = { payload: { operationId: prepared.operationId } };
      const member = yield* createMember(client, testEmail(`${crypto.randomUUID()}@example.com`));
      expect(
        yield* client.sessionKey.approveManagedOperation(approval).pipe(Effect.flip),
      ).toMatchObject({ code: "OPERATION_UNAVAILABLE" });
      yield* signIn(client, testEmail(`${crypto.randomUUID()}@example.com`));
      expect(
        yield* client.sessionKey.approveManagedOperation(approval).pipe(Effect.flip),
      ).toMatchObject({ code: "OPERATION_UNAVAILABLE" });
      yield* setAuthToken(member.ownerToken);
      yield* client.sessionKey.revoke({ params: { sessionKeyId: session.id } });
      expect(
        yield* client.sessionKey.approveManagedOperation(approval).pipe(Effect.flip),
      ).toMatchObject({ code: "APPROVAL_EXPIRED" });
      expect(yield* Ref.get(control.calls)).toEqual([]);
      expect(
        (yield* repository.core.sessionKeyOperation.findById({
          id: prepared.operationId,
          organizationId,
        }))?.data.signed,
      ).toBeNull();
      expect(actor.actor.organization.id).toBe(organizationId);
    }),
  );

  it.effect("rechecks membership even when the caller supplies previously authorized kinds", () =>
    Effect.gen(function* () {
      const { actor, prepared, control, repository, organizationId } = yield* setupManagedSession;
      // Simulate membership changing after transport authorization. The isolated
      // fixture contains only the initiating membership.
      const db = yield* Database;
      yield* db.update(organizationMember).set({ removedAt: new Date() });
      const app = yield* Application;
      expect(
        yield* app.sessionKey
          .approveManagedOperation({
            organizationId,
            actorId: actor.actor.actorId,
            allowedKinds: ["install"],
            request: { operationId: prepared.operationId },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "OPERATION_UNAVAILABLE" });
      expect(yield* Ref.get(control.calls)).toEqual([]);
      expect(
        (yield* repository.core.sessionKeyOperation.findById({
          id: prepared.operationId,
          organizationId,
        }))?.leaseToken,
      ).toBeNull();
    }),
  );

  it.effect("fences a concurrent request and allows recovery of an abandoned unsigned lease", () =>
    Effect.gen(function* () {
      const { client, actor, prepared, control, repository, organizationId } =
        yield* setupManagedSession;
      const scope = { id: prepared.operationId, organizationId };
      const now = yield* DateTime.now;
      yield* repository.core.sessionKeyOperation.claimForSigning({
        ...scope,
        actorId: actor.actor.actorId,
        now,
        leaseToken: "abandoned",
        leaseExpiresAt: DateTime.add(now, { seconds: 10 }),
      });
      const approval = { payload: { operationId: prepared.operationId } };
      expect(
        yield* client.sessionKey.approveManagedOperation(approval).pipe(Effect.flip),
      ).toMatchObject({ code: "OPERATION_BUSY" });
      expect(yield* Ref.get(control.calls)).toEqual([]);
      yield* TestClock.adjust(Duration.seconds(11));
      expect(yield* client.sessionKey.approveManagedOperation(approval)).toMatchObject({
        status: "signed",
      });
      expect(yield* Ref.get(control.calls)).toEqual(["signing.signDigest"]);
    }),
  );

  it.effect("rejects a stored call substitution before reaching the provider", () =>
    Effect.gen(function* () {
      const { client, prepared, control, repository, organizationId } = yield* setupManagedSession;
      const db = yield* Database;
      const stored = yield* repository.core.sessionKeyOperation.findById({
        id: prepared.operationId,
        organizationId,
      });
      if (!stored) return yield* Effect.die("Missing operation");
      // This isolated fixture contains exactly one operation.
      yield* db.update(sessionKeyOperation).set({
        data: Schema.encodeSync(SessionKeyOperationData)({
          ...stored.data,
          prepared: {
            ...stored.data.prepared,
            context: {
              ...stored.data.prepared.context,
              calls: [
                {
                  to: stored.data.prepared.context.account,
                  value: 0n,
                  data: Hex.make("0xdeadbeef"),
                },
              ],
            },
          },
        }),
      });
      expect(
        yield* client.sessionKey
          .approveManagedOperation({ payload: { operationId: prepared.operationId } })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "APPROVAL_INVALID" });
      expect(yield* Ref.get(control.calls)).toEqual([]);
    }),
  );

  if (process.env.NAMERA_TEST_POSTGRES_PORT)
    it.effect("accepts concurrent approvals once", () =>
      Effect.gen(function* () {
        const { client, prepared, control } = yield* setupManagedSession;
        const results = yield* Effect.all(
          Array.from({ length: 8 }, () =>
            client.sessionKey
              .approveManagedOperation({ payload: { operationId: prepared.operationId } })
              .pipe(Effect.result),
          ),
          { concurrency: "unbounded" },
        );
        expect(results.some(Result.isSuccess)).toBe(true);
        expect(yield* Ref.get(control.calls)).toEqual(["signing.signDigest"]);
        expect(
          (yield* client.sessionKey.getOperation({ params: { operationId: prepared.operationId } }))
            .status,
        ).toBe("signed");
      }),
    );
});
