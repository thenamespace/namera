import { expect, layer } from "@effect/vitest";
import { Context, Effect, Exit, Option, Ref, Schema } from "effect";
import { TestClock } from "effect/testing";

import { Application } from "@namera-ai/application";
import { Database, Repository, sessionKeyOperation } from "@namera-ai/database";
import { makeTestEvmExecutionService } from "@namera-ai/evm";
import { EthereumAddress, EvmExecutionError } from "@namera-ai/protocol";
import { SessionKeyOperationData } from "@namera-ai/protocol/model";

import { makeTestApiClient, resetTestState, signIn, testEmail } from "../../fixtures/index.js";
import { createTestPasskeyWallet, localSessionRequest } from "../../fixtures/local-session.js";
import { makeOwnerSessionTestFixture } from "../../fixtures/owner-session.js";

const control = Context.Reference<
  | {
      readonly sends: Ref.Ref<number>;
      readonly outcome: "rejected" | "unknown" | "lookup-outage" | "pending" | "interrupted";
      readonly receipt?: "success" | "failure" | "mismatch";
    }
  | undefined
>("test/sessionRecovery/control", { defaultValue: () => undefined });
const provider = makeTestEvmExecutionService();
const fixture = makeOwnerSessionTestFixture({
  submit: Effect.fnUntraced(function* (input) {
    const scenario = yield* control;
    if (!scenario) return yield* provider.submit(input);
    yield* Ref.update(scenario.sends, (count) => count + 1);
    if (scenario.outcome === "interrupted") {
      yield* provider.submit(input);
      return yield* Effect.interrupt;
    }
    if (scenario.outcome === "pending") return yield* provider.submit(input);
    return yield* new EvmExecutionError({
      code: scenario.outcome === "unknown" ? "SUBMISSION_UNKNOWN" : "SUBMISSION_REJECTED",
      cause: "Synthetic submission response",
    });
  }),
  getStatus: Effect.fnUntraced(function* () {
    if ((yield* control)?.outcome === "lookup-outage") {
      return yield* new EvmExecutionError({
        code: "SUBMISSION_UNKNOWN",
        cause: "Synthetic lookup outage",
      });
    }
    return { status: "not_found", transactionHash: null };
  }),
  getReceipt: Effect.fnUntraced(function* (input) {
    const scenario = yield* control;
    if (scenario && !scenario.receipt) return Option.none();
    return Option.map(yield* provider.getReceipt(input), (receipt) => ({
      ...receipt,
      sender: EthereumAddress.make("0x3333333333333333333333333333333333333333"),
      nonce: receipt.nonce + (scenario?.receipt === "mismatch" ? 1n : 0n),
      ...(scenario?.receipt === "failure"
        ? { success: false as const, reason: "Synthetic included revert" }
        : { success: true as const, reason: null }),
    }));
  }),
});

layer(fixture.layer)("session submission recovery", (it) => {
  for (const kind of ["install", "uninstall"] as const) {
    for (const outcome of [
      "rejected",
      "unknown",
      "lookup-outage",
      "pending",
      "interrupted",
    ] as const) {
      it.effect(`${kind}: ${outcome} preserves the correct terminal/uncertain boundary`, () =>
        Effect.gen(function* () {
          yield* resetTestState();
          const client = yield* makeTestApiClient;
          const owner = yield* signIn(client, testEmail(`${kind}-${outcome}@example.com`));
          const wallet = yield* createTestPasskeyWallet(client);
          const session = yield* client.sessionKey.create({
            payload: yield* localSessionRequest(wallet.id),
          });
          if (kind === "uninstall") {
            yield* fixture.confirmOperation(client, session, "install");
            yield* client.sessionKey.revoke({ params: { sessionKeyId: session.id } });
          }
          const installation = session.installations[0];
          if (!installation) return yield* Effect.die("Missing installation");
          const prepared = yield* client.sessionKey.prepareOperation({
            payload: {
              installationId: installation.id,
              kind,
              sponsor: true,
              idempotencyKey: "recovery",
            },
          });
          yield* client.sessionKey.completeOperation({
            payload: {
              operationId: prepared.operationId,
              response: fixture.authenticator.authenticate({
                challenge: prepared.options.challenge,
                origin: "http://dashboard.test",
                rpId: "dashboard.test",
                counter: 0,
              }),
            },
          });
          const app = yield* Application;
          const repository = yield* Repository;
          const scope = { id: prepared.operationId, organizationId: owner.actor.organization.id };
          const sends = yield* Ref.make(0);
          const scenario = { sends, outcome };
          yield* TestClock.adjust("2 seconds");
          const first = yield* Effect.all(
            Array.from({ length: process.env.NAMERA_TEST_POSTGRES_PORT ? 8 : 1 }, () =>
              app.sessionKey.reconcileOperations().pipe(Effect.provideService(control, scenario)),
            ),
            { concurrency: "unbounded" },
          ).pipe(Effect.exit);
          if (outcome === "interrupted") {
            expect(Exit.hasInterrupts(first)).toBe(true);
            yield* TestClock.adjust("2 minutes");
          } else {
            expect(Exit.isSuccess(first)).toBe(true);
          }
          yield* TestClock.adjust("16 seconds");
          yield* app.sessionKey
            .reconcileOperations()
            .pipe(Effect.provideService(control, scenario));
          expect(yield* Ref.get(sends)).toBe(1);
          expect((yield* repository.core.sessionKeyOperation.findById(scope))?.status).toBe(
            outcome === "rejected" ? "failed" : outcome === "pending" ? "submitted" : "signed",
          );
          const holds = yield* repository.billing.usageReservation.listBySource(
            scope.organizationId,
            "session-key-operation",
            scope.id,
          );
          expect(holds).toHaveLength(2);
          expect(
            holds.every((hold) => hold.status === (outcome === "rejected" ? "released" : "active")),
          ).toBe(true);

          if (outcome === "rejected") {
            const current = yield* repository.core.sessionKeyInstallation.findById({
              id: installation.id,
              organizationId: scope.organizationId,
            });
            expect(current?.status).toBe(kind === "install" ? "pending" : "revoking");
            // The failed operation no longer blocks a new owner-approved attempt.
            expect(
              yield* client.sessionKey.prepareOperation({
                payload: {
                  installationId: installation.id,
                  kind,
                  sponsor: true,
                  idempotencyKey: "retry",
                },
              }),
            ).toHaveProperty("operationId");
            const events = yield* repository.audit.organization.findForOrganization(
              scope.organizationId,
            );
            expect(
              events.filter(({ event }) => event === "session_key.operation_failed"),
            ).toHaveLength(1);
            return;
          }

          expect(
            yield* client.sessionKey
              .cancelOperation({ params: { operationId: scope.id } })
              .pipe(Effect.flip),
          ).toMatchObject({ code: "OPERATION_UNAVAILABLE" });
          yield* TestClock.adjust("25 hours");
          yield* app.sessionKey
            .reconcileOperations()
            .pipe(Effect.provideService(control, scenario));
          yield* app.billing.reconcile();
          expect(
            (yield* repository.billing.usageReservation.listBySource(
              scope.organizationId,
              "session-key-operation",
              scope.id,
            )).every((hold) => hold.status === "active"),
          ).toBe(true);
          yield* TestClock.adjust("5 minutes");
          yield* app.sessionKey
            .reconcileOperations()
            .pipe(Effect.provideService(control, { ...scenario, receipt: "mismatch" }));
          expect(
            (yield* repository.core.sessionKeyOperation.findById(scope))?.finishedAt,
          ).toBeNull();
          yield* TestClock.adjust("5 minutes");
          const receipt = outcome === "lookup-outage" ? "failure" : "success";
          yield* app.sessionKey
            .reconcileOperations()
            .pipe(Effect.provideService(control, { ...scenario, receipt }));
          expect((yield* repository.core.sessionKeyOperation.findById(scope))?.status).toBe(
            receipt === "success" ? "confirmed" : "failed",
          );
          expect(yield* app.sessionKey.reconcileOperations()).toBe(0);
          expect(yield* Ref.get(sends)).toBe(1);
          const settled = yield* repository.billing.usageReservation.listBySource(
            scope.organizationId,
            "session-key-operation",
            scope.id,
          );
          expect(settled.find((hold) => hold.meterKey !== "gas-sponsorship")?.status).toBe(
            "settled",
          );
          expect(settled.find((hold) => hold.meterKey === "gas-sponsorship")?.status).toBe(
            "active",
          );
        }),
      );
    }
  }

  it.effect("recovers legacy signed work without sending or releasing it", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("legacy-session@example.com"));
      const wallet = yield* createTestPasskeyWallet(client);
      const session = yield* client.sessionKey.create({
        payload: yield* localSessionRequest(wallet.id),
      });
      const installation = session.installations[0];
      if (!installation) return yield* Effect.die("Missing installation");
      const prepared = yield* client.sessionKey.prepareOperation({
        payload: {
          installationId: installation.id,
          kind: "install",
          sponsor: true,
          idempotencyKey: "legacy",
        },
      });
      yield* client.sessionKey.completeOperation({
        payload: {
          operationId: prepared.operationId,
          response: fixture.authenticator.authenticate({
            challenge: prepared.options.challenge,
            origin: "http://dashboard.test",
            rpId: "dashboard.test",
            counter: 0,
          }),
        },
      });
      const repository = yield* Repository;
      const scope = { id: prepared.operationId, organizationId: owner.actor.organization.id };
      const stored = yield* repository.core.sessionKeyOperation.findById(scope);
      if (!stored) return yield* Effect.die("Missing operation");
      const { broadcastAttempted: _attempted, ...data } = stored.data;
      // Exactly one operation exists in this isolated fixture.
      yield* (yield* Database)
        .update(sessionKeyOperation)
        .set({ data: Schema.encodeSync(SessionKeyOperationData)(data) });
      const app = yield* Application;
      const sends = yield* Ref.make(0);
      yield* TestClock.adjust("2 seconds");
      yield* app.sessionKey
        .reconcileOperations()
        .pipe(Effect.provideService(control, { sends, outcome: "rejected" }));
      expect((yield* repository.core.sessionKeyOperation.findById(scope))?.status).toBe("signed");
      expect(
        (yield* repository.billing.usageReservation.listBySource(
          scope.organizationId,
          "session-key-operation",
          scope.id,
        )).every((hold) => hold.status === "active"),
      ).toBe(true);
      yield* TestClock.adjust("16 seconds");
      yield* app.sessionKey
        .reconcileOperations()
        .pipe(Effect.provideService(control, { sends, outcome: "rejected", receipt: "success" }));
      expect((yield* repository.core.sessionKeyOperation.findById(scope))?.status).toBe(
        "confirmed",
      );
      expect(yield* Ref.get(sends)).toBe(0);
    }),
  );
});
