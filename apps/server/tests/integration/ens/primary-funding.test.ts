import { expect, layer } from "@effect/vitest";
import { DateTime, Duration, Effect, Schema } from "effect";
import { TestClock } from "effect/testing";

import { NameraApi } from "@namera-ai/api";
import { Application } from "@namera-ai/application";
import { Database, Repository, walletOperation } from "@namera-ai/database";
import { TestEvmExecution } from "@namera-ai/evm";
import { EthereumAddress } from "@namera-ai/protocol";
import { WalletOperation, WalletOperationData } from "@namera-ai/protocol/model";

import { handledApi } from "../../fixtures/http-api-test.js";
import { makeTestApiClient, resetTestState, signIn, testEmail } from "../../fixtures/index.js";
import { createTestPasskeyWallet } from "../../fixtures/local-session.js";
import { makeOwnerSessionTestFixture } from "../../fixtures/owner-session.js";

const fixture = makeOwnerSessionTestFixture(
  {
    getStatus: () => Effect.succeed({ status: "not_found", transactionHash: null }),
  },
  {
    identity: {
      status: (_name, address) =>
        Effect.succeed({ primaryName: null, forwardAddress: address, verified: false }),
      call: () =>
        Effect.succeed({
          to: EthereumAddress.make("0x4444444444444444444444444444444444444444"),
          value: 0n,
          data: "0x1234",
        }),
    },
  },
);

const setup = Effect.gen(function* () {
  yield* resetTestState();
  yield* TestClock.setTime(Date.now());
  const control = yield* TestEvmExecution;
  yield* control.setSubmissionMode("accepted");
  yield* control.setFunded(true);
  yield* control.setReceiptMode("missing");
  const author = yield* signIn(
    yield* makeTestApiClient,
    testEmail(`primary-funding-${crypto.randomUUID()}@example.com`),
  );
  const client = yield* handledApi(NameraApi, {
    headers: { cookie: `auth-token=${author.cookie.value}`, origin: "http://dashboard.test" },
  });
  const wallet = yield* createTestPasskeyWallet(client);
  const params = { walletId: wallet.id, label: "treasury" };
  yield* client.identity.create({ params, payload: { label: params.label } });
  const prepare = (idempotencyKey = "primary-funding", sponsor = true) =>
    client.walletTransaction.prepare({
      params,
      headers: { "idempotency-key": idempotencyKey },
      payload: {
        namespace: "eip155",
        chainId: "eip155:1",
        sponsor,
        calls: [
          {
            to: EthereumAddress.make("0x4444444444444444444444444444444444444444"),
            value: 0n,
            data: "0x1234",
          },
        ],
      },
    });
  const approve = Effect.fnUntraced(function* (sponsor = true) {
    const prepared = yield* prepare("primary-funding", sponsor);
    if (prepared.signing.method !== "passkey") return yield* Effect.die("Missing passkey options");
    yield* client.walletTransaction.complete({
      params,
      payload: {
        namespace: "eip155" as const,
        operationId: prepared.operationId,
        response: fixture.authenticator.authenticate({
          challenge: prepared.signing.options.challenge,
          origin: "http://dashboard.test",
          rpId: "dashboard.test",
          counter: 0,
        }),
      },
    });
    yield* TestClock.adjust(Duration.seconds(2));
    return prepared;
  });
  const db = yield* Database;
  const app = yield* Application;
  return { client, params, control, prepare, approve, db, app };
});

layer(fixture.layer)("primary name funding and recovery", (it) => {
  it.effect("keeps accepted but unobserved operations pending without rebroadcast or release", () =>
    Effect.gen(function* () {
      const { approve, control, db, app } = yield* setup;
      yield* approve();
      const before = yield* control.submissionCount;
      yield* app.wallet.transactions.reconcile();
      for (const delay of [Duration.seconds(20), Duration.hours(25)]) {
        yield* TestClock.adjust(delay);
        yield* app.wallet.transactions.reconcile();
        expect((yield* db.query.walletOperation.findMany())[0]?.status).toBe("submitted");
        expect(
          (yield* db.query.billingUsageReservation.findMany()).every(
            (reservation) => reservation.status === "active",
          ),
        ).toBe(true);
      }
      expect(yield* control.submissionCount).toBe(before + 1);
    }),
  );
  it.effect("reserves sponsorship before approval and settles provider cost exactly once", () =>
    Effect.gen(function* () {
      const { prepare, approve, control, db, app } = yield* setup;
      yield* control.setFunded(false);
      expect((yield* prepare()).prepared.sponsorship).toBe("alchemy-bso");
      yield* prepare();
      expect(
        (yield* db.query.billingUsageReservation.findMany()).filter(
          (r) => r.meterKey === "gas-sponsorship",
        ),
      ).toHaveLength(1);
      yield* approve();
      yield* control.setReceiptMode("immediate");
      yield* app.wallet.transactions.reconcile();
      yield* app.billing.reconcileSponsorships();
      yield* app.billing.reconcileSponsorships();
      const gas = (yield* db.query.billingUsageReservation.findMany()).find(
        (r) => r.meterKey === "gas-sponsorship",
      );
      expect(gas?.status).toBe("settled");
      const events = (yield* db.query.billingUsageEvent.findMany()).filter(
        (r) => r.meterKey === "gas-sponsorship",
      );
      expect(events).toHaveLength(1);
      expect(events[0]?.amount).toBe(32_400n);
    }),
  );

  it.effect("allows explicit account gas when quota is short and rejects an unfunded account", () =>
    Effect.gen(function* () {
      const { prepare, approve, control, db } = yield* setup;
      const gas = (yield* db.query.billingMeterBalance.findMany()).find(
        (row) => row.meterKey === "gas-sponsorship",
      );
      if (!gas || gas.hardLimitAmount === null) return yield* Effect.die("Missing gas balance");
      yield* (yield* Repository).billing.meterBalance.replaceProjection(
        gas.organizationId,
        gas.periodId,
        "gas-sponsorship",
        gas.hardLimitAmount + 50_000n,
        0n,
      );
      yield* control.setFunded(false);
      expect(yield* prepare().pipe(Effect.flip)).toMatchObject({
        code: "LIMIT_EXCEEDED",
        limit: "gas-sponsorship",
      });
      expect(yield* prepare("primary-funding", false).pipe(Effect.flip)).toMatchObject({
        code: "INSUFFICIENT_FUNDS",
      });
      expect(yield* db.query.walletOperation.findMany()).toHaveLength(0);
      expect(yield* db.query.billingUsageReservation.findMany()).toHaveLength(0);
      yield* control.setFunded(true);
      expect((yield* prepare("primary-funding", false)).prepared.sponsorship).toBe("none");
      expect(yield* db.query.billingUsageReservation.findMany()).toHaveLength(0);
      yield* control.setFunded(false);
      expect(yield* approve(false).pipe(Effect.flip)).toMatchObject({ code: "INSUFFICIENT_FUNDS" });
      expect((yield* db.query.walletOperation.findMany())[0]?.status).toBe("awaiting-signature");
    }),
  );

  it.effect("releases unsigned sponsorship on expiry", () =>
    Effect.gen(function* () {
      const { prepare, db, app } = yield* setup;
      const prepared = yield* prepare();
      yield* TestClock.setTime(DateTime.toEpochMillis(prepared.expiresAt) + 1);
      yield* app.wallet.transactions.reconcile();
      expect((yield* db.query.billingUsageReservation.findMany())[0]?.status).toBe("expired");
    }),
  );

  it.effect("stops ambiguous broadcasts after 24 hours without releasing holds", () =>
    Effect.gen(function* () {
      const { approve, control, db, app, client, params } = yield* setup;
      yield* approve();
      yield* control.setSubmissionMode("unknown");
      yield* app.wallet.transactions.reconcile();
      const sent = yield* control.submissionCount;
      yield* TestClock.adjust(Duration.hours(25));
      yield* app.wallet.transactions.reconcile();
      expect(yield* control.submissionCount).toBe(sent);
      expect(
        (yield* db.query.billingUsageReservation.findMany()).every((r) => r.status === "active"),
      ).toBe(true);
      yield* control.setReceiptMode("immediate");
      yield* TestClock.adjust(Duration.minutes(6));
      yield* app.wallet.transactions.reconcile();
      expect((yield* client.identity.primaryStatus({ params })).operation?.status).toBe(
        "confirmed",
      );
    }),
  );

  it.effect("fails a first rejected send and releases both holds without retrying", () =>
    Effect.gen(function* () {
      const { approve, control, db, app, client, params } = yield* setup;
      yield* approve();
      yield* control.setSubmissionMode("rejected");
      const before = yield* control.submissionCount;
      yield* app.wallet.transactions.reconcile();
      expect((yield* client.identity.primaryStatus({ params })).operation?.status).toBe("failed");
      expect(
        (yield* db.query.billingUsageReservation.findMany()).every((r) => r.status === "released"),
      ).toBe(true);
      yield* TestClock.adjust(Duration.minutes(6));
      yield* app.wallet.transactions.reconcile();
      expect(yield* control.submissionCount).toBe(before + 1);
    }),
  );

  for (const legacy of [false, true])
    it.effect(
      `preserves ${legacy ? "legacy" : "ambiguous"} sends on rejection and recovers a later receipt`,
      () =>
        Effect.gen(function* () {
          const { approve, control, db, app, client, params } = yield* setup;
          yield* approve();
          if (legacy) {
            const row = (yield* db.query.walletOperation.findMany())[0];
            if (!row) return yield* Effect.die("Missing operation");
            const operation = Schema.decodeSync(WalletOperation)(row);
            const { broadcastAttempted: _, ...data } = operation.data;
            // This isolated fixture contains exactly one operation.
            yield* db
              .update(walletOperation)
              .set({ data: Schema.encodeSync(WalletOperationData)(data) });
          } else {
            yield* control.setSubmissionMode("unknown");
            yield* app.wallet.transactions.reconcile();
            yield* TestClock.adjust(Duration.seconds(16));
          }
          yield* control.setSubmissionMode("rejected");
          yield* app.wallet.transactions.reconcile();
          const status = (yield* client.identity.primaryStatus({ params })).operation;
          expect(status?.status).toBe("signed");
          expect(status?.submissionBlocked).toBe(true);
          const sends = yield* control.submissionCount;
          yield* TestClock.adjust(Duration.minutes(6));
          yield* app.wallet.transactions.reconcile();
          expect(yield* control.submissionCount).toBe(sends);
          expect(
            (yield* db.query.billingUsageReservation.findMany()).every(
              (r) => r.status === "active",
            ),
          ).toBe(true);
          yield* control.setReceiptMode("immediate");
          yield* TestClock.adjust(Duration.minutes(6));
          yield* app.wallet.transactions.reconcile();
          expect((yield* client.identity.primaryStatus({ params })).operation?.status).toBe(
            "confirmed",
          );
        }),
    );
});
