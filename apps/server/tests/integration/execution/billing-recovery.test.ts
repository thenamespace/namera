import { describe, expect, layer } from "@effect/vitest";
import { Deferred, Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";

import { Application } from "@namera-ai/application";
import { Repository, TransactionService } from "@namera-ai/database";

import {
  makeTestApiClient,
  resetTestState,
  setApiKey,
  setAuthToken,
  signIn,
  testEmail,
} from "../../fixtures/index.js";
import { createExecutionFixture, executionFixture, queueExecution } from "./fixture.js";

describe.skipIf(process.env.NAMERA_TEST_POSTGRES_PORT === undefined)(
  "PostgreSQL execution billing recovery",
  () => {
    layer(executionFixture.layer)((it) => {
      it.effect(
        "defers busy submissions without blocking settlement or releasing their holds",
        () =>
          Effect.gen(function* () {
            yield* resetTestState();
            const client = yield* makeTestApiClient;
            const owner = yield* signIn(client, testEmail("billing-lock-order@example.com"));
            const organizationId = owner.actor.organization.id;
            const { wallet, sessionKey, apiKey } = yield* createExecutionFixture(client, "billing");
            yield* setAuthToken();
            yield* setApiKey(apiKey.key);
            const queued = yield* queueExecution(client, {
              headers: { "idempotency-key": "billing-lock-order" },
              payload: {
                namespace: "eip155",
                walletId: wallet.id,
                sessionKeyId: sessionKey.id,
                chainId: "eip155:1",
                calls: [{ to: wallet.address, value: 0n, data: "0x" }],
              },
            });
            yield* TestClock.adjust("6 minutes");
            const repository = yield* Repository;
            const transaction = yield* TransactionService;
            const app = yield* Application;
            const locked = yield* Deferred.make<void>();
            const unlock = yield* Deferred.make<void>();
            const holder = yield* transaction
              .run(
                Effect.gen(function* () {
                  const submission = yield* repository.core.executionSubmission.findByIdForUpdate(
                    queued.submissionId,
                    organizationId,
                  );
                  expect(submission).toBeDefined();
                  yield* Deferred.succeed(locked, undefined);
                  yield* Deferred.await(unlock);
                }),
              )
              .pipe(Effect.forkChild);
            yield* Deferred.await(locked);
            // Recovery must finish while another transaction still owns the row.
            yield* app.billing
              .reconcile()
              .pipe(Effect.ensuring(Deferred.succeed(unlock, undefined)));
            yield* Fiber.join(holder);
            const reservations = yield* repository.billing.usageReservation.listBySource(
              organizationId,
              "execution-submission",
              queued.submissionId,
            );
            expect(reservations).toHaveLength(2);
            expect(reservations.every(({ status }) => status === "active")).toBe(true);
            expect(yield* app.execution.reconcile()).toBe(1);
            yield* TestClock.adjust("16 seconds");
            expect(yield* app.execution.reconcile()).toBe(1);
            expect(
              yield* client.execution.getSubmission({
                params: { submissionId: queued.submissionId },
              }),
            ).toMatchObject({ status: "confirmed" });
            expect(
              (yield* repository.billing.usageReservation.listBySource(
                organizationId,
                "execution-submission",
                queued.submissionId,
              )).every(({ status }) => status === "settled"),
            ).toBe(true);
          }),
      );
    });
  },
);
