import { expect, layer } from "@effect/vitest";
import { Context, DateTime, Duration, Effect, Option, Ref } from "effect";
import { TestClock } from "effect/testing";

import { makeTestEvmExecutionService } from "@namera-ai/evm";
import { EthereumAddress, EvmExecutionError, Hex } from "@namera-ai/protocol";

import { queueRecoveryExecution } from "../../fixtures/execution-recovery.js";
import { resetTestState } from "../../fixtures/index.js";
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
        const { owner, queued, repository, app } = yield* queueRecoveryExecution(
          fixture,
          `first-${scenario}`,
        );
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
