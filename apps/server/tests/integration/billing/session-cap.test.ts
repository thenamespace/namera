import { describe, expect, layer } from "@effect/vitest";
import { DateTime, Effect, Result } from "effect";
import { TestClock } from "effect/testing";

import { Repository } from "@namera-ai/database";
import { makeTestEvmSessionService } from "@namera-ai/evm";

import {
  createOrganization,
  makeTestApiClient,
  resetTestState,
  signIn,
  testEmail,
} from "../../fixtures/index.js";
import { makeTestServerLayer } from "../../fixtures/layers/index.js";
import { createTestPasskeyWallet, localSessionRequest } from "../../fixtures/local-session.js";
import { makeOwnerSessionTestFixture } from "../../fixtures/owner-session.js";

const TestServerLayer = makeTestServerLayer({ sessions: makeTestEvmSessionService() });
const activeFixture = makeOwnerSessionTestFixture();

layer(activeFixture.layer)("Active session capacity", (it) => {
  it.effect("retains installed transaction authority after a signature policy expires", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("active-session-expiry@example.com"));
      const wallet = yield* createTestPasskeyWallet(client);
      const request = yield* localSessionRequest(wallet.id);
      const session = yield* client.sessionKey.create({
        payload: {
          ...request,
          policies: [
            {
              type: "evm.time-window",
              version: 1,
              startsAt: null,
              expiresAt: DateTime.add(yield* DateTime.now, { minutes: 1 }),
            },
          ],
        },
      });
      expect((yield* activeFixture.confirmOperation(client, session, "install")).status).toBe(
        "active",
      );
      yield* TestClock.adjust("2 minutes");
      expect(
        (yield* client.billing.get()).resources.find(({ key }) => key === "local-session-keys")
          ?.usedAmount,
      ).toBe(1n);
      expect((yield* client.sessionKey.get({ params: { sessionKeyId: session.id } })).status).toBe(
        "active",
      );
    }),
  );
});

layer(TestServerLayer)("Free v2 session capacity", (it) => {
  it.effect(
    "counts pending multi-network keys once, enforces the cap, and releases expired capacity",
    () =>
      Effect.gen(function* () {
        yield* resetTestState();
        const client = yield* makeTestApiClient;
        const owner = yield* signIn(client, testEmail("v2-session-cap@example.com"));
        const wallet = yield* createTestPasskeyWallet(client);
        const now = yield* DateTime.now;
        for (let index = 0; index < 100; index++) {
          const request = yield* localSessionRequest(wallet.id, ["eip155:1", "eip155:8453"]);
          yield* client.sessionKey.create({
            payload: {
              ...request,
              onchain: {
                installations: Array.from(
                  request.onchain.installations,
                  (installation, network) => ({
                    ...installation,
                    validUntil: installation.validUntil + network * 3600,
                  }),
                ),
              },
              policies: [
                {
                  type: "evm.time-window",
                  version: 1,
                  startsAt: null,
                  expiresAt: DateTime.add(now, { minutes: 1 }),
                },
              ],
            },
          });
        }
        // Signature expiry and expiry on one network must not free transaction capacity.
        yield* TestClock.setTime(DateTime.toEpochMillis(DateTime.add(now, { minutes: 61 })));
        const resource = (yield* client.billing.get()).resources.find(
          ({ key }) => key === "local-session-keys",
        );
        expect(resource).toMatchObject({ usedAmount: 100n, remainingAmount: 0n });
        const denied = yield* client.sessionKey
          .create({ payload: yield* localSessionRequest(wallet.id) })
          .pipe(Effect.flip);
        expect(denied).toMatchObject({ code: "LIMIT_EXCEEDED", limit: "localSessionKeys" });
        const repository = yield* Repository;
        const later = DateTime.add(now, { hours: 3 });
        expect(
          (yield* repository.billing.usage.getForOrganization(owner.actor.organization.id, later))
            .localSessionKeys,
        ).toBe(0);
        yield* TestClock.setTime(DateTime.toEpochMillis(later));
        yield* client.sessionKey.create({ payload: yield* localSessionRequest(wallet.id) });
        expect(
          (yield* client.billing.get()).resources.find(({ key }) => key === "local-session-keys")
            ?.usedAmount,
        ).toBe(1n);
      }),
    { timeout: 30000 },
  );
});

describe.skipIf(process.env.NAMERA_TEST_POSTGRES_PORT === undefined)(
  "Free v2 concurrent admission",
  () => {
    layer(TestServerLayer)((it) => {
      it.effect("serializes the final owned organization slot", () =>
        Effect.gen(function* () {
          yield* resetTestState();
          const client = yield* makeTestApiClient;
          yield* signIn(client, testEmail("v2-org-race@example.com"));
          yield* createOrganization(client, "Second");
          const outcomes = yield* Effect.all(
            Array.from({ length: 5 }, (_, index) =>
              createOrganization(client, `Contender ${index}`).pipe(Effect.result),
            ),
            { concurrency: 5 },
          );
          expect(outcomes.filter(Result.isSuccess)).toHaveLength(1);
          for (const result of outcomes.filter(Result.isFailure))
            expect(result.failure).toMatchObject({ limit: "ownedOrganizations" });
          expect(yield* client.organization.list()).toHaveLength(3);
        }),
      );
      it.effect(
        "serializes the final session-key slot",
        () =>
          Effect.gen(function* () {
            yield* resetTestState();
            const client = yield* makeTestApiClient;
            yield* signIn(client, testEmail("v2-session-race@example.com"));
            const wallet = yield* createTestPasskeyWallet(client);
            for (let index = 0; index < 99; index++)
              yield* client.sessionKey.create({ payload: yield* localSessionRequest(wallet.id) });
            const requests = yield* Effect.forEach(Array.from({ length: 5 }), () =>
              localSessionRequest(wallet.id),
            );
            const outcomes = yield* Effect.forEach(
              requests,
              (payload) => client.sessionKey.create({ payload }).pipe(Effect.result),
              { concurrency: 5 },
            );
            expect(outcomes.filter(Result.isSuccess)).toHaveLength(1);
            for (const result of outcomes.filter(Result.isFailure))
              expect(result.failure).toMatchObject({ limit: "localSessionKeys" });
            expect(
              (yield* client.billing.get()).resources.find(
                ({ key }) => key === "local-session-keys",
              )?.usedAmount,
            ).toBe(100n);
          }),
        { timeout: 30000 },
      );
    });
  },
);
