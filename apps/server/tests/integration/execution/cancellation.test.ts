import { expect, layer } from "@effect/vitest";
import { Deferred, Duration, Effect, Exit, Fiber } from "effect";
import { TestClock } from "effect/testing";

import { Application } from "@namera-ai/application";
import { Repository } from "@namera-ai/database";
import { TestEvmExecution } from "@namera-ai/evm";
import { Hex } from "@namera-ai/protocol";

import { executionFixture } from "../../fixtures/execution.js";
import {
  makeTestApiClient,
  resetTestState,
  setApiKey,
  signIn,
  testEmail,
} from "../../fixtures/index.js";
import { createTestPasskeyWallet, localSessionRequest } from "../../fixtures/local-session.js";
import { setupManagedOperations } from "../../fixtures/managed-session-operations.js";
import { makeSessionCustodyLayer } from "../../fixtures/session-custody.js";

const setup = Effect.gen(function* () {
  yield* resetTestState();
  const client = yield* makeTestApiClient;
  const owner = yield* signIn(client, testEmail("cancel-execution@example.com"));
  const wallet = yield* createTestPasskeyWallet(client);
  const sessionKey = yield* client.sessionKey.create({
    payload: {
      ...(yield* localSessionRequest(wallet.id)),
      policies: [
        {
          type: "evm.native-spend-limit",
          version: 1,
          limits: [{ chainId: "eip155:1", period: "lifetime", maxAmount: 10n }],
        },
      ],
    },
  });
  yield* executionFixture.confirmOperation(client, sessionKey, "install");
  const apiKey = yield* client.apiKey.create({
    payload: {
      metadata: { version: 1, name: "Cancellation" },
      durationDays: 1,
      sessionKeyIds: [sessionKey.id],
    },
  });
  const otherApiKey = yield* client.apiKey.create({
    payload: {
      metadata: { version: 1, name: "Other actor" },
      durationDays: 1,
      sessionKeyIds: [sessionKey.id],
    },
  });
  yield* setApiKey(apiKey.key);
  const request = {
    headers: { "idempotency-key": crypto.randomUUID() },
    payload: {
      namespace: "eip155" as const,
      walletId: wallet.id,
      sessionKeyId: sessionKey.id,
      chainId: "eip155:1" as const,
      sponsor: true,
      calls: [{ to: wallet.address, value: 5n, data: Hex.make("0x") }],
    },
  };
  const prepared = yield* client.execution.prepare(request);
  const params = { submissionId: prepared.submissionId };
  const complete = client.execution.complete({
    payload: {
      namespace: "eip155",
      submissionId: prepared.submissionId,
      signature: Hex.make(`0x${"11".repeat(64)}1b`),
    },
  });
  const repository = yield* Repository;
  const holds = repository.billing.usageReservation.listBySource(
    owner.actor.organization.id,
    "execution-submission",
    prepared.submissionId,
  );
  const policy = sessionKey.policies[0];
  if (!policy) return yield* Effect.die("Missing policy");
  const states = repository.core.sessionKeyPolicyState.findForPolicy(
    owner.actor.organization.id,
    sessionKey.id,
    policy.id,
  );
  return { client, request, params, complete, holds, states, apiKey, otherApiKey };
});

layer(executionFixture.layer)("execution cancellation", (it) => {
  it.effect("releases sponsored gas and count exactly once and rejects stale signatures", () =>
    Effect.gen(function* () {
      const f = yield* setup;
      expect((yield* f.holds).map((hold) => hold.status)).toEqual(["active", "active"]);
      expect(yield* f.states).toMatchObject([{ data: { spent: "0", reserved: "5" } }]);
      yield* setApiKey(f.otherApiKey.key);
      expect(
        yield* f.client.execution.cancel({ params: f.params }).pipe(Effect.flip),
      ).toMatchObject({ code: "EXECUTION_UNAVAILABLE" });
      expect((yield* f.holds).map((hold) => hold.status)).toEqual(["active", "active"]);
      yield* setApiKey(f.apiKey.key);
      const results = yield* Effect.all(
        [
          f.client.execution.cancel({ params: f.params }),
          f.client.execution.cancel({ params: f.params }),
        ],
        { concurrency: 2 },
      );
      expect(results.map((result) => result.status)).toEqual(["cancelled", "cancelled"]);
      expect((yield* f.holds).map((hold) => hold.status)).toEqual(["released", "released"]);
      expect(yield* f.states).toMatchObject([{ data: { spent: "0", reserved: "0" } }]);
      expect(yield* f.complete.pipe(Effect.flip)).toMatchObject({ code: "EXECUTION_UNAVAILABLE" });
      expect((yield* f.client.execution.getSubmission({ params: f.params })).status).toBe(
        "cancelled",
      );
      expect(yield* f.client.execution.prepare(f.request).pipe(Effect.flip)).toMatchObject({
        code: "EXECUTION_UNAVAILABLE",
      });
    }),
  );
  it.effect("allows exactly one winner when cancellation races signature acceptance", () =>
    Effect.gen(function* () {
      const f = yield* setup;
      const results = yield* Effect.all(
        [
          f.complete.pipe(Effect.exit),
          f.client.execution.cancel({ params: f.params }).pipe(Effect.exit),
        ],
        { concurrency: 2 },
      );
      expect(results.filter((result) => Exit.isSuccess<unknown, unknown>(result))).toHaveLength(1);
      const status = (yield* f.client.execution.getSubmission({ params: f.params })).status;
      expect(["prepared", "cancelled"]).toContain(status);
      expect(
        (yield* f.holds).every(
          (hold) => hold.status === (status === "cancelled" ? "released" : "active"),
        ),
      ).toBe(true);
    }),
  );
  it.effect("never releases signed or pending submissions with missing receipts", () =>
    Effect.gen(function* () {
      const f = yield* setup;
      yield* f.complete;
      for (const submitted of [false, true]) {
        if (submitted) {
          yield* (yield* TestEvmExecution).setReceiptMode("missing");
          yield* TestClock.adjust(Duration.seconds(2));
          yield* (yield* Application).execution.reconcile();
        }
        expect((yield* f.client.execution.getSubmission({ params: f.params })).status).toBe(
          submitted ? "submitted" : "prepared",
        );
        expect(
          yield* f.client.execution.cancel({ params: f.params }).pipe(Effect.flip),
        ).toMatchObject({ code: "EXECUTION_UNAVAILABLE" });
        expect((yield* f.holds).map((hold) => hold.status)).toEqual(["active", "active"]);
      }
    }),
  );
});

const started = Deferred.makeUnsafe<void>();
layer(
  makeSessionCustodyLayer("10 seconds", Deferred.succeed(started, undefined).pipe(Effect.asVoid)),
)("managed signing cancellation race", (it) => {
  it.effect("does not release reservations while signing owns an active lease", () =>
    Effect.gen(function* () {
      const f = yield* setupManagedOperations("1claw");
      const prepared = yield* f.client.execution.prepare(f.executionRequest);
      const params = { submissionId: prepared.submissionId };
      const fiber = yield* f.client.execution
        .complete({ payload: { namespace: "eip155", ...params } })
        .pipe(Effect.forkChild);
      yield* Deferred.await(started);
      expect(yield* f.client.execution.cancel({ params }).pipe(Effect.flip)).toMatchObject({
        code: "EXECUTION_UNAVAILABLE",
      });
      expect(
        (yield* f.repository.billing.usageReservation.listBySource(
          f.organizationId,
          "execution-submission",
          prepared.submissionId,
        ))[0]?.status,
      ).toBe("active");
      yield* TestClock.adjust(Duration.seconds(10));
      expect((yield* Fiber.join(fiber)).status).toBe("prepared");
    }),
  );
});
