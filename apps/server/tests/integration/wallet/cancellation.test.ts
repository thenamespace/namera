import { expect, layer } from "@effect/vitest";
import { DateTime, Duration, Effect, Exit } from "effect";
import { TestClock } from "effect/testing";

import { NameraApi } from "@namera-ai/api";
import { Application } from "@namera-ai/application";
import { Database, Repository } from "@namera-ai/database";
import { TestEvmExecution } from "@namera-ai/evm";

import { handledApi } from "../../fixtures/http-api-test.js";
import { makeTestApiClient, resetTestState, signIn, testEmail } from "../../fixtures/index.js";
import { createTestPasskeyWallet } from "../../fixtures/local-session.js";
import { makeOwnerSessionTestFixture } from "../../fixtures/owner-session.js";

const fixture = makeOwnerSessionTestFixture();
const setup = Effect.gen(function* () {
  yield* resetTestState();
  const owner = yield* signIn(
    yield* makeTestApiClient,
    testEmail(`${crypto.randomUUID()}@example.com`),
  );
  const client = yield* handledApi(NameraApi, {
    headers: { cookie: `auth-token=${owner.cookie.value}`, origin: "http://dashboard.test" },
  });
  const wallet = yield* createTestPasskeyWallet(client);
  const request = {
    params: { walletId: wallet.id },
    headers: { "idempotency-key": "cancel-wallet" },
    payload: {
      namespace: "eip155" as const,
      chainId: "eip155:1" as const,
      sponsor: true,
      calls: [{ to: wallet.address, value: 0n, data: "0x" as const }],
    },
  };
  const prepared = yield* client.walletTransaction.prepare(request);
  if (prepared.signing.method !== "passkey") return yield* Effect.die("Expected passkey");
  const params = { walletId: wallet.id, operationId: prepared.operationId };
  const complete = client.walletTransaction.complete({
    params: request.params,
    payload: {
      namespace: "eip155",
      operationId: prepared.operationId,
      response: fixture.authenticator.authenticate({
        challenge: prepared.signing.options.challenge,
        origin: "http://dashboard.test",
        rpId: "dashboard.test",
        counter: 0,
      }),
    },
  });
  const repository = yield* Repository;
  const holds = repository.billing.usageReservation.listBySource(
    owner.actor.organization.id,
    "wallet-operation",
    prepared.operationId,
  );
  return { client, owner, request, params, prepared, complete, holds, repository };
});

layer(fixture.layer)("owner transaction cancellation", (it) => {
  it.effect("releases once, invalidates the old approval, and admits a fresh preparation", () =>
    Effect.gen(function* () {
      const f = yield* setup;
      expect((yield* f.holds).map((hold) => hold.status)).toEqual(["active"]);
      const results = yield* Effect.all(
        [
          f.client.walletTransaction.cancel({ params: f.params }),
          f.client.walletTransaction.cancel({ params: f.params }),
        ],
        { concurrency: 2 },
      );
      expect(results.map((result) => result.status)).toEqual(["cancelled", "cancelled"]);
      expect((yield* f.holds).map((hold) => hold.status)).toEqual(["released"]);
      expect(yield* f.complete.pipe(Effect.flip)).toMatchObject({ code: "APPROVAL_EXPIRED" });
      expect(yield* f.client.walletTransaction.prepare(f.request).pipe(Effect.flip)).toMatchObject({
        code: "OPERATION_UNAVAILABLE",
      });
      const fresh = yield* f.client.walletTransaction.prepare({
        ...f.request,
        headers: { "idempotency-key": "fresh-wallet" },
      });
      expect(fresh.operationId).not.toBe(f.prepared.operationId);
      const events = yield* (yield* Database).query.organizationEvent.findMany();
      expect(events.filter((event) => event.event === "wallet.operation_cancelled")).toHaveLength(
        1,
      );
    }),
  );

  it.effect("races signature acceptance without releasing a winning approval's holds", () =>
    Effect.gen(function* () {
      const f = yield* setup;
      const results = yield* Effect.all(
        [
          f.complete.pipe(Effect.exit),
          f.client.walletTransaction.cancel({ params: f.params }).pipe(Effect.exit),
        ],
        { concurrency: 2 },
      );
      expect(results.filter((result) => Exit.isSuccess<unknown, unknown>(result))).toHaveLength(1);
      const status = (yield* f.client.walletTransaction.get({ params: f.params })).status;
      expect(["signed", "cancelled"]).toContain(status);
      expect(
        (yield* f.holds).every(
          (hold) => hold.status === (status === "signed" ? "active" : "released"),
        ),
      ).toBe(true);
    }),
  );

  it.effect(
    "rejects active signing leases and fences completion after an expired lease is cancelled",
    () =>
      Effect.gen(function* () {
        const f = yield* setup;
        const now = yield* DateTime.now;
        const scope = { id: f.params.operationId, organizationId: f.owner.actor.organization.id };
        expect(
          yield* f.repository.core.walletOperation.claimForSigning({
            ...scope,
            actorId: f.owner.actor.actorId,
            now,
            leaseToken: "signing",
            leaseExpiresAt: DateTime.addDuration(now, Duration.minutes(2)),
          }),
        ).toBeDefined();
        expect(
          yield* f.client.walletTransaction.cancel({ params: f.params }).pipe(Effect.flip),
        ).toMatchObject({ code: "OPERATION_UNAVAILABLE" });
        expect((yield* f.holds)[0]?.status).toBe("active");
        yield* TestClock.adjust(Duration.minutes(2));
        expect((yield* f.client.walletTransaction.cancel({ params: f.params })).status).toBe(
          "cancelled",
        );
        expect(yield* f.complete.pipe(Effect.flip)).toMatchObject({ code: "APPROVAL_EXPIRED" });
      }),
  );

  it.effect("never cancels signed or submitted operations, even with missing receipts", () =>
    Effect.gen(function* () {
      const f = yield* setup;
      yield* f.complete;
      for (const submitted of [false, true]) {
        if (submitted) {
          yield* (yield* TestEvmExecution).setReceiptMode("missing");
          yield* TestClock.adjust(Duration.seconds(2));
          yield* (yield* Application).wallet.transactions.reconcile();
        }
        expect((yield* f.client.walletTransaction.get({ params: f.params })).status).toBe(
          submitted ? "submitted" : "signed",
        );
        expect(
          yield* f.client.walletTransaction.cancel({ params: f.params }).pipe(Effect.flip),
        ).toMatchObject({ code: "OPERATION_UNAVAILABLE" });
        expect((yield* f.holds).map((hold) => hold.status)).toEqual(["active", "active"]);
      }
    }),
  );

  it.effect("rejects foreign tenants and origins without releasing the hold", () =>
    Effect.gen(function* () {
      const f = yield* setup;
      const foreign = yield* signIn(
        yield* makeTestApiClient,
        testEmail("cancel-other@example.com"),
      );
      for (const headers of [
        { cookie: `auth-token=${foreign.cookie.value}`, origin: "http://dashboard.test" },
        { cookie: `auth-token=${f.owner.cookie.value}`, origin: "https://evil.test" },
      ]) {
        const client = yield* handledApi(NameraApi, { headers });
        const result = yield* client.walletTransaction
          .cancel({ params: f.params })
          .pipe(Effect.exit);
        expect(Exit.isFailure(result)).toBe(true);
      }
      expect((yield* f.holds)[0]?.status).toBe("active");
    }),
  );

  it.effect("serializes cancellation against unsigned expiry without reviving the operation", () =>
    Effect.gen(function* () {
      const f = yield* setup;
      yield* TestClock.adjust(Duration.minutes(6));
      const app = yield* Application;
      yield* Effect.all(
        [
          f.client.walletTransaction.cancel({ params: f.params }).pipe(Effect.exit),
          app.wallet.transactions.reconcile().pipe(Effect.exit),
        ],
        { concurrency: 2 },
      );
      const status = (yield* f.client.walletTransaction.get({ params: f.params })).status;
      expect(["cancelled", "expired"]).toContain(status);
      expect(
        (yield* f.holds).every((hold) => hold.status === "released" || hold.status === "expired"),
      ).toBe(true);
      expect(yield* f.complete.pipe(Effect.flip)).toMatchObject({ code: "APPROVAL_EXPIRED" });
    }),
  );
});
