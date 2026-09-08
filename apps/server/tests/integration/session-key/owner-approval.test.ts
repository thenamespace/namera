import { expect, layer } from "@effect/vitest";
import { DateTime, Duration, Effect } from "effect";
import { TestClock } from "effect/testing";

import { Application, makeBillingMetering } from "@namera-ai/application";
import { Repository } from "@namera-ai/database";
import { TestEvmExecution } from "@namera-ai/evm";

import {
  createMember,
  makeTestApiClient,
  resetTestState,
  setAuthToken,
  signIn,
  testEmail,
} from "../../fixtures/index.js";
import { registerPendingLocalSession } from "../../fixtures/local-session.js";
import { makeOwnerSessionTestFixture } from "../../fixtures/owner-session.js";

const fixture = makeOwnerSessionTestFixture();
const { authenticator } = fixture;

layer(fixture.layer)("owner approval", (it) => {
  it.effect(
    "settles included failures without activating the session and permits a new approval",
    () =>
      Effect.gen(function* () {
        yield* resetTestState();
        const client = yield* makeTestApiClient;
        const owner = yield* signIn(client, testEmail("owner-failed-install@namera.test"));
        const { session } = yield* registerPendingLocalSession(client, ["eip155:1"]);
        const installation = session.installations[0];
        if (installation === undefined) return yield* Effect.die("Missing fixture installation");
        const payload = {
          installationId: installation.id,
          kind: "install" as const,
          idempotencyKey: crypto.randomUUID(),
          sponsor: true,
        };
        const prepared = yield* client.sessionKey.prepareOperation({ payload });
        yield* client.sessionKey.completeOperation({
          payload: {
            operationId: prepared.operationId,
            response: authenticator.authenticate({
              challenge: prepared.options.challenge,
              origin: "http://dashboard.test",
              rpId: "dashboard.test",
              counter: 1,
            }),
          },
        });
        yield* (yield* TestEvmExecution).setReceiptMode("failed");
        yield* TestClock.adjust(Duration.seconds(2));
        const app = yield* Application;
        expect(yield* app.sessionKey.reconcileOperations()).toBe(1);
        const repository = yield* Repository;
        const updated = yield* client.sessionKey.get({ params: { sessionKeyId: session.id } });
        expect(updated.status).toBe("pending");
        expect(updated.installations.find(({ id }) => id === installation.id)?.status).toBe(
          "failed",
        );
        const reservations = yield* repository.billing.usageReservation.listBySource(
          owner.actor.organization.id,
          "session-key-operation",
          prepared.operationId,
        );
        expect(reservations).toHaveLength(2);
        expect(reservations.every(({ status }) => status === "settled")).toBe(true);
        for (const reservation of reservations) {
          expect(
            yield* repository.billing.usageEvent.getNetAmount(
              owner.actor.organization.id,
              reservation.periodId,
              reservation.meterKey,
            ),
          ).toBe(reservation.meterKey === "gas-sponsorship" ? 32_400n : 1n);
        }
        expect(
          (yield* repository.core.sessionKeyOperation.findById({
            id: prepared.operationId,
            organizationId: owner.actor.organization.id,
          }))?.status,
        ).toBe("failed");
        const retry = yield* client.sessionKey.prepareOperation({
          payload: {
            ...payload,
            idempotencyKey: crypto.randomUUID(),
          },
        });
        expect(retry.operationId).not.toBe(prepared.operationId);
        expect(yield* app.sessionKey.reconcileOperations()).toBe(0);
      }),
  );
  it.effect(
    "verifies the real assertion and atomically consumes its counter, billing and operation",
    () =>
      Effect.gen(function* () {
        yield* resetTestState();
        const client = yield* makeTestApiClient;
        const owner = yield* signIn(client, testEmail("owner-approval@namera.test"));
        yield* (yield* TestEvmExecution).setReceiptMode("immediate");
        const { session, wallet } = yield* registerPendingLocalSession(client);
        const installation = session.installations[0];
        if (installation === undefined) return yield* Effect.die("Missing fixture installation");
        const prepared = yield* client.sessionKey.prepareOperation({
          payload: {
            installationId: installation.id,
            kind: "install",
            idempotencyKey: crypto.randomUUID(),
            sponsor: false,
          },
        });
        const ceremony = {
          challenge: prepared.options.challenge,
          origin: "http://dashboard.test",
          rpId: "dashboard.test",
          counter: 1,
        };
        const invalid = authenticator.authenticate({
          ...ceremony,
          origin: "https://attacker.test",
        });
        expect(
          yield* client.sessionKey
            .completeOperation({
              payload: { operationId: prepared.operationId, response: invalid },
            })
            .pipe(Effect.flip),
        ).toMatchObject({ code: "APPROVAL_INVALID" });
        const repository = yield* Repository;
        const keyBefore = (yield* repository.core.wallet.findById(
          wallet.id,
          owner.actor.organization.id,
        ))?.signingKey;
        expect(keyBefore?.data).toMatchObject({ signCount: 0 });
        const response = authenticator.authenticate(ceremony);
        const payload = { operationId: prepared.operationId, response };
        const otherOwner = yield* signIn(client, testEmail("approval-other-org@namera.test"));
        yield* setAuthToken(owner.cookie.value);
        const admin = yield* createMember(client, testEmail("approval-admin@namera.test"), "admin");
        for (const token of [otherOwner.cookie.value, admin.memberToken]) {
          yield* setAuthToken(token);
          expect(
            yield* client.sessionKey.completeOperation({ payload }).pipe(Effect.flip),
          ).toMatchObject({ code: "OPERATION_UNAVAILABLE" });
        }
        expect(
          (yield* repository.core.wallet.findById(wallet.id, owner.actor.organization.id))
            ?.signingKey.data,
        ).toMatchObject({ signCount: 0 });
        expect(
          yield* repository.core.sessionKeyOperation.findById({
            id: prepared.operationId,
            organizationId: owner.actor.organization.id,
          }),
        ).toMatchObject({ status: "awaiting-signature", data: { signed: null } });
        expect(
          yield* repository.billing.usageReservation.listBySource(
            owner.actor.organization.id,
            "session-key-operation",
            prepared.operationId,
          ),
        ).toHaveLength(0);
        yield* setAuthToken(owner.cookie.value);
        const metering = yield* makeBillingMetering;
        const fullQuota = yield* metering.reserve({
          organizationId: owner.actor.organization.id,
          meterKey: "execution.testnet",
          amount: 1000n,
          sourceType: "manual-adjustment",
          sourceId: crypto.randomUUID(),
          expiresAt: DateTime.addDuration(yield* DateTime.now, Duration.hours(1)),
        });
        expect(
          yield* client.sessionKey.completeOperation({ payload }).pipe(Effect.flip),
        ).toMatchObject({ code: "LIMIT_EXCEEDED", limit: "execution.testnet" });
        expect(
          (yield* repository.core.wallet.findById(wallet.id, owner.actor.organization.id))
            ?.signingKey.data,
        ).toMatchObject({ signCount: 0 });
        expect(
          (yield* repository.core.sessionKeyOperation.findById({
            id: prepared.operationId,
            organizationId: owner.actor.organization.id,
          }))?.data.signed,
        ).toBeNull();
        yield* metering.release({
          organizationId: owner.actor.organization.id,
          reservationId: fullQuota.id,
        });
        const accepted = yield* client.sessionKey.completeOperation({ payload });
        expect(accepted).toEqual({ operationId: prepared.operationId, status: "signed" });
        const activeParams = { installationId: installation.id, kind: "install" as const };
        expect(yield* client.sessionKey.getActiveOperation({ params: activeParams })).toEqual({
          operation: { operationId: prepared.operationId, status: "signed", retryRequest: null },
        });
        expect(yield* client.sessionKey.completeOperation({ payload })).toEqual(accepted);
        const keyAfter = (yield* repository.core.wallet.findById(
          wallet.id,
          owner.actor.organization.id,
        ))?.signingKey;
        expect(keyAfter?.data).toMatchObject({ signCount: 1 });
        const stored = yield* repository.core.sessionKeyOperation.findById({
          id: prepared.operationId,
          organizationId: owner.actor.organization.id,
        });
        expect(stored?.data.signed).not.toBeNull();
        const reservations = yield* repository.billing.usageReservation.listBySource(
          owner.actor.organization.id,
          "session-key-operation",
          prepared.operationId,
        );
        expect(reservations).toHaveLength(1);
        expect(reservations[0]).toMatchObject({
          meterKey: "execution.testnet",
          amount: 1n,
          status: "active",
        });
        expect(
          (yield* repository.audit.organization.findForOrganization(
            owner.actor.organization.id,
          )).filter(({ event }) => event === "session_key.operation_approved"),
        ).toHaveLength(1);
        expect(
          (yield* client.sessionKey.get({ params: { sessionKeyId: session.id } })).status,
        ).toBe("pending");
        // Signed approvals survive their HTTP ceremony TTL. Only a bound receipt
        // activates the permission and settles the reserved usage, exactly once.
        const app = yield* Application;
        yield* (yield* TestEvmExecution).setReceiptMode("missing");
        yield* TestClock.adjust(Duration.seconds(2));
        expect(yield* app.sessionKey.reconcileOperations()).toBe(1);
        expect(
          (yield* repository.core.sessionKeyOperation.findById({
            id: prepared.operationId,
            organizationId: owner.actor.organization.id,
          }))?.status,
        ).toBe("submitted");
        expect(
          (yield* client.sessionKey.get({ params: { sessionKeyId: session.id } })).status,
        ).toBe("pending");
        expect(yield* app.sessionKey.reconcileOperations()).toBe(0);
        yield* (yield* TestEvmExecution).setReceiptMode("immediate");
        yield* TestClock.adjust(Duration.minutes(6));
        expect(yield* app.sessionKey.reconcileOperations()).toBe(1);
        expect(yield* app.sessionKey.reconcileOperations()).toBe(0);
        expect(
          (yield* client.sessionKey.get({ params: { sessionKeyId: session.id } })).status,
        ).toBe("active");
        expect(yield* client.sessionKey.getActiveOperation({ params: activeParams })).toEqual({
          operation: null,
        });
        expect(
          (yield* repository.core.sessionKeyOperation.findById({
            id: prepared.operationId,
            organizationId: owner.actor.organization.id,
          }))?.status,
        ).toBe("confirmed");
        expect(
          (yield* repository.billing.usageReservation.listBySource(
            owner.actor.organization.id,
            "session-key-operation",
            prepared.operationId,
          ))[0]?.status,
        ).toBe("settled");
        expect(
          (yield* repository.audit.organization.findForOrganization(
            owner.actor.organization.id,
          )).filter(({ event }) => event === "session_key.operation_confirmed"),
        ).toHaveLength(1);
      }),
  );
});
