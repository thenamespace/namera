import { expect, it } from "@effect/vitest";
import { Deferred, Duration, Effect, Fiber, Logger, References, Schema } from "effect";
import { TestClock } from "effect/testing";

import { NameraApi } from "@namera-ai/api";
import { Application } from "@namera-ai/application";
import { Database } from "@namera-ai/database";
import { TestEvmExecution } from "@namera-ai/evm";
import { EthereumAddress, EvmExecutionError } from "@namera-ai/protocol";

import { handledApi } from "../../fixtures/http-api-test.js";
import { makeTestApiClient, resetTestState, signIn, testEmail } from "../../fixtures/index.js";
import { createTestPasskeyWallet } from "../../fixtures/local-session.js";
import { makeOwnerSessionTestFixture } from "../../fixtures/owner-session.js";

it.effect(
  "retains pending operations through missing hashes, lookup errors and age without rebroadcast",
  () =>
    Effect.gen(function* () {
      let lookup: "not_found" | "submitted" | "rpc_error" | "decode_error" | "timeout" =
        "not_found";
      let lookupStarted: Deferred.Deferred<void> | undefined;
      const secret = "synthetic-secret-signed-payload";
      const fixture = makeOwnerSessionTestFixture({
        getStatus: () =>
          Effect.gen(function* () {
            if (lookup === "timeout") {
              if (lookupStarted) yield* Deferred.succeed(lookupStarted, undefined);
              return yield* Effect.never;
            }
            if (lookup === "rpc_error")
              return yield* new EvmExecutionError({
                code: "RECEIPT_LOOKUP_FAILED",
                cause: new Error(secret),
              });
            if (lookup === "decode_error") {
              const cause = yield* Schema.decodeUnknownEffect(Schema.Number)(secret).pipe(
                Effect.flip,
                Effect.orDie,
              );
              return yield* new EvmExecutionError({ code: "RECEIPT_LOOKUP_FAILED", cause });
            }
            return { status: lookup, transactionHash: null };
          }),
      });

      yield* Effect.gen(function* () {
        yield* resetTestState();
        const author = yield* signIn(
          yield* makeTestApiClient,
          testEmail("pending-reconciliation@example.com"),
        );
        const client = yield* handledApi(NameraApi, {
          headers: { cookie: `auth-token=${author.cookie.value}`, origin: "http://dashboard.test" },
        });
        const wallet = yield* createTestPasskeyWallet(client);
        const params = { walletId: wallet.id };
        const prepared = yield* client.walletTransaction.prepare({
          params,
          headers: { "idempotency-key": "pending-recovery" },
          payload: {
            namespace: "eip155",
            chainId: "eip155:1",
            sponsor: true,
            calls: [
              {
                to: EthereumAddress.make("0x4444444444444444444444444444444444444444"),
                value: 0n,
                data: "0x",
              },
            ],
          },
        });
        if (prepared.signing.method !== "passkey") return yield* Effect.die("Expected passkey");
        yield* client.walletTransaction.complete({
          params,
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
        const execution = yield* TestEvmExecution;
        yield* execution.setReceiptMode("missing");
        const app = yield* Application;
        const db = yield* Database;
        const initialSubmissions = yield* execution.submissionCount;
        yield* TestClock.adjust(Duration.seconds(2));
        const claims = yield* Effect.all(
          [app.wallet.transactions.reconcile(), app.wallet.transactions.reconcile()],
          { concurrency: 2 },
        );
        expect(claims.reduce((total, count) => total + count, 0)).toBe(1);
        expect(yield* execution.submissionCount).toBe(initialSubmissions + 1);
        const logs: Array<{ message: unknown; annotations: unknown; cause: unknown }> = [];
        const logger = Logger.make((entry) => {
          logs.push({
            message: entry.message,
            annotations: entry.fiber.getRef(References.CurrentLogAnnotations),
            cause: entry.cause,
          });
        });

        for (const state of [
          "submitted",
          "rpc_error",
          "decode_error",
          "timeout",
          "not_found",
          "submitted",
        ] as const) {
          lookup = state;
          expect(yield* app.wallet.transactions.reconcile()).toBe(0);
          const scheduled = (yield* db.query.walletOperation.findMany())[0];
          if (!scheduled?.leaseExpiresAt) return yield* Effect.die("Missing durable retry time");
          yield* TestClock.setTime(scheduled.leaseExpiresAt.getTime() + 1);
          const run = app.wallet.transactions
            .reconcile()
            .pipe(Effect.provide(Logger.layer([logger])));
          if (state === "timeout") {
            lookupStarted = yield* Deferred.make<void>();
            const fiber = yield* run.pipe(Effect.forkChild);
            yield* Deferred.await(lookupStarted);
            yield* TestClock.adjust(Duration.seconds(61));
            yield* Fiber.join(fiber);
          } else yield* run;
          const updated = (yield* db.query.walletOperation.findMany())[0];
          expect(updated?.data.reconciliation?.attempts).toBe(
            (scheduled.data.reconciliation?.attempts ?? 0) + 1,
          );
          expect(updated?.data.reconciliation?.consecutiveErrors).toBe(
            ["rpc_error", "decode_error", "timeout"].includes(state)
              ? (scheduled.data.reconciliation?.consecutiveErrors ?? 0) + 1
              : 0,
          );
          expect(
            yield* client.walletTransaction.get({
              params: { ...params, operationId: prepared.operationId },
            }),
          ).toMatchObject({ status: "submitted", transactionHash: null });
          expect(yield* execution.submissionCount).toBe(initialSubmissions + 1);
          const reservations = yield* db.query.billingUsageReservation.findMany();
          expect(reservations.length).toBeGreaterThan(0);
          expect(
            reservations
              .filter((row) => row.sourceId === prepared.operationId)
              .map((row) => row.status),
          ).toEqual(["active", "active"]);
        }
        const failures = logs.filter((entry) =>
          String(entry.message).includes("wallet.operation.reconciliation_failed"),
        );
        expect(failures).toHaveLength(3);
        expect(failures.map((entry) => entry.annotations)).toEqual([
          expect.objectContaining({
            operation_id: prepared.operationId,
            operation_status: "submitted",
            chain_id: "eip155:1",
            error_type: "EvmExecutionError",
            error_code: "RECEIPT_LOOKUP_FAILED",
            response_decode_failed: false,
          }),
          expect.objectContaining({ response_decode_failed: true }),
          expect.objectContaining({ error_type: "TimeoutError", response_decode_failed: false }),
        ]);
        expect(JSON.stringify(logs)).not.toContain(secret);

        yield* TestClock.adjust(Duration.hours(25));
        yield* app.wallet.transactions.reconcile();
        expect(yield* execution.submissionCount).toBe(initialSubmissions + 1);
        expect(
          (yield* client.walletTransaction.get({
            params: { ...params, operationId: prepared.operationId },
          })).status,
        ).toBe("submitted");
        yield* execution.setReceiptMode("immediate");
        yield* TestClock.adjust(Duration.minutes(20));
        yield* app.wallet.transactions.reconcile();
        expect(
          (yield* client.walletTransaction.get({
            params: { ...params, operationId: prepared.operationId },
          })).status,
        ).toBe("confirmed");
        expect(yield* execution.submissionCount).toBe(initialSubmissions + 1);
        const audits = yield* db.query.organizationEvent.findMany();
        expect(audits.filter((row) => row.event === "wallet.operation_failed")).toHaveLength(0);
        expect(audits.filter((row) => row.event === "wallet.operation_confirmed")).toHaveLength(1);
      }).pipe(Effect.provide(fixture.layer));
    }),
);
