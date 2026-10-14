import { expect, layer } from "@effect/vitest";
import { Context, DateTime, Duration, Effect, Option, Ref } from "effect";
import { TestClock } from "effect/testing";

import { Application } from "@namera-ai/application";
import { Repository } from "@namera-ai/database";
import { makeTestEvmExecutionService } from "@namera-ai/evm";
import { EthereumAddress, EvmExecutionError, Hex } from "@namera-ai/protocol";

import { queueExecution } from "../../fixtures/execution.js";
import {
  makeTestApiClient,
  resetTestState,
  setApiKey,
  setAuthToken,
  signIn,
  testEmail,
} from "../../fixtures/index.js";
import { createTestPasskeyWallet, localSessionRequest } from "../../fixtures/local-session.js";
import { makeOwnerSessionTestFixture } from "../../fixtures/owner-session.js";

const sends = Context.Reference<Ref.Ref<number> | undefined>("test/rejection/sends", {
  defaultValue: () => undefined,
});
const lookupFails = Context.Reference<boolean>("test/rejection/lookupFails", {
  defaultValue: () => false,
});
const provider = makeTestEvmExecutionService();
const fixture = makeOwnerSessionTestFixture({
  sessionSigningMessage: () => Effect.succeed(Hex.make(`0x${"22".repeat(32)}`)),
  completeSessionExecution: provider.sign,
  submit: Effect.fnUntraced(function* (input) {
    const counter = yield* sends;
    if (!counter) return yield* provider.submit(input);
    if (counter) yield* Ref.update(counter, (n) => n + 1);
    return yield* new EvmExecutionError({
      code: "SUBMISSION_REJECTED",
      cause: "Synthetic precheck rejection",
    });
  }),
  getStatus: Effect.fnUntraced(function* () {
    if (yield* lookupFails)
      return yield* new EvmExecutionError({
        code: "SUBMISSION_UNKNOWN",
        cause: "Synthetic lookup outage",
      });
    return { status: "not_found", transactionHash: null };
  }),
  getReceipt: Effect.fnUntraced(function* (input) {
    if (yield* sends) return Option.none();
    return Option.map(yield* provider.getReceipt(input), (receipt) => ({
      ...receipt,
      sender: EthereumAddress.make("0x3333333333333333333333333333333333333333"),
    }));
  }),
});

layer(fixture.layer)("first-send evidence", (it) => {
  for (const scenario of ["rejected", "lookup-outage", "crash-before-rpc"] as const) {
    it.effect(`protects reservations and one-send semantics: ${scenario}`, () =>
      Effect.gen(function* () {
        yield* resetTestState();
        const client = yield* makeTestApiClient;
        const owner = yield* signIn(client, testEmail(`first-${scenario}@example.com`));
        const wallet = yield* createTestPasskeyWallet(client);
        const session = yield* client.sessionKey.create({
          payload: yield* localSessionRequest(wallet.id),
        });
        // Installation setup uses its normal package-owned provider, not the failure injection.
        yield* fixture.confirmOperation(client, session, "install");
        const apiKey = yield* client.apiKey.create({
          payload: {
            metadata: { version: 1, name: "Recovery" },
            durationDays: 7,
            sessionKeyIds: [session.id],
          },
        });
        yield* setAuthToken();
        yield* setApiKey(apiKey.key);
        const queued = yield* queueExecution(client, {
          headers: { "idempotency-key": scenario },
          payload: {
            namespace: "eip155",
            walletId: wallet.id,
            sessionKeyId: session.id,
            chainId: "eip155:1",
            calls: [{ to: wallet.address, value: 0n, data: "0x" }],
          },
        });
        const repository = yield* Repository;
        const app = yield* Application;
        const counter = yield* Ref.make(0);
        yield* TestClock.adjust("2 seconds");
        if (scenario === "crash-before-rpc") {
          const now = yield* DateTime.now;
          yield* repository.core.executionSubmission.claimForReconciliation({
            now,
            leaseToken: "lost-worker",
            leaseExpiresAt: DateTime.addDuration(now, Duration.minutes(2)),
            limit: 1,
          });
          expect(
            yield* repository.core.executionSubmission.recordBroadcastAttempt({
              id: queued.submissionId,
              organizationId: owner.actor.organization.id,
              leaseToken: "lost-worker",
              now,
            }),
          ).toBeDefined();
          yield* TestClock.adjust("2 minutes");
        }
        yield* app.execution
          .reconcile()
          .pipe(
            Effect.provideService(sends, counter),
            Effect.provideService(lookupFails, scenario === "lookup-outage"),
          );
        yield* TestClock.adjust("16 seconds");
        yield* app.execution.reconcile().pipe(Effect.provideService(sends, counter));
        expect(yield* Ref.get(counter)).toBe(scenario === "crash-before-rpc" ? 0 : 1);
        expect(
          (yield* repository.core.executionSubmission.findById(
            queued.submissionId,
            owner.actor.organization.id,
          ))?.status,
        ).toBe(scenario === "rejected" ? "failed" : "prepared");
        const holds = yield* repository.billing.usageReservation.listBySource(
          owner.actor.organization.id,
          "execution-submission",
          queued.submissionId,
        );
        expect(holds).toHaveLength(2);
        expect(
          holds.every((hold) => hold.status === (scenario === "rejected" ? "released" : "active")),
        ).toBe(true);
        const events = yield* repository.audit.organization.findForOrganization(
          owner.actor.organization.id,
        );
        expect(events.filter(({ event }) => event === "execution.failed")).toHaveLength(
          scenario === "rejected" ? 1 : 0,
        );
      }),
    );
  }
});
