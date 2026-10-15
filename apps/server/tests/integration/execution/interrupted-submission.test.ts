import { expect, layer } from "@effect/vitest";
import { Context, Effect, Exit } from "effect";
import { TestClock } from "effect/testing";

import { makeTestEvmExecutionService, TestEvmExecution } from "@namera-ai/evm";
import { Hex } from "@namera-ai/protocol";

import { queueRecoveryExecution } from "../../fixtures/execution-recovery.js";
import { resetTestState, setApiKey, setAuthToken } from "../../fixtures/index.js";
import { makeOwnerSessionTestFixture } from "../../fixtures/owner-session.js";

const interruptAfterSubmit = Context.Reference<boolean>("test/interruptAfterSubmit", {
  defaultValue: () => false,
});
const provider = makeTestEvmExecutionService();
const fixture = makeOwnerSessionTestFixture({
  sessionSigningMessage: () => Effect.succeed(Hex.make(`0x${"22".repeat(32)}`)),
  completeSessionExecution: provider.sign,
  submit: Effect.fn("test.interruptedSubmission.submit")(function* (input) {
    const accepted = yield* provider.submit(input);
    if (yield* interruptAfterSubmit) return yield* Effect.interrupt;
    return accepted;
  }),
});

layer(fixture.layer)("interrupted provider submission", (it) => {
  it.effect("recovers the durable signed envelope after lease expiry and settles once", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const { client, owner, queued, organizationId, repository, app } =
        yield* queueRecoveryExecution(fixture, "interrupted-submission");
      const original = yield* repository.core.executionSubmission.findById(
        queued.submissionId,
        organizationId,
      );
      expect(original).toBeDefined();
      expect(original?.data.signedExecution).not.toBeNull();
      const execution = yield* TestEvmExecution;
      const sendsBefore = yield* execution.submissionCount;
      yield* TestClock.adjust("2 seconds");
      const stopped = yield* app.execution
        .reconcile()
        .pipe(Effect.provideService(interruptAfterSubmit, true), Effect.exit);
      expect(Exit.hasInterrupts(stopped)).toBe(true);
      expect(yield* execution.submissionCount).toBe(sendsBefore + 1);
      const abandoned = yield* repository.core.executionSubmission.findById(
        queued.submissionId,
        organizationId,
      );
      expect(abandoned?.status).toBe("prepared");
      expect(abandoned?.data.broadcastAttempted).toBe(true);
      expect(abandoned?.leaseToken).not.toBeNull();
      expect(abandoned?.data.signedExecution).toEqual(original?.data.signedExecution);
      expect(yield* app.execution.reconcile()).toBe(0);
      const holds = yield* repository.billing.usageReservation.listBySource(
        organizationId,
        "execution-submission",
        queued.submissionId,
      );
      expect(holds).toHaveLength(2);
      expect(holds.every(({ status }) => status === "active")).toBe(true);

      yield* TestClock.adjust("2 minutes");
      expect(yield* app.execution.reconcile()).toBe(1);
      yield* TestClock.adjust("16 seconds");
      expect(yield* app.execution.reconcile()).toBe(1);
      expect(yield* app.execution.reconcile()).toBe(0);
      expect(
        yield* client.execution.getSubmission({ params: { submissionId: queued.submissionId } }),
      ).toMatchObject({ status: "confirmed" });
      expect(yield* execution.submissionCount).toBe(sendsBefore + 1);
      yield* app.billing.reconcile();
      expect(
        (yield* repository.billing.usageReservation.listBySource(
          organizationId,
          "execution-submission",
          queued.submissionId,
        )).every(({ status }) => status === "settled"),
      ).toBe(true);
      yield* setApiKey();
      yield* setAuthToken(owner.cookie.value);
      const billing = yield* client.billing.get();
      expect(billing.meters.find(({ key }) => key === "execution.mainnet")).toMatchObject({
        consumedAmount: 2n,
        reservedAmount: 0n,
      });
      expect(billing.meters.find(({ key }) => key === "gas-sponsorship")).toMatchObject({
        consumedAmount: 32_400n,
        reservedAmount: 0n,
      });
      const events = yield* repository.audit.organization.findForOrganization(organizationId);
      expect(events.filter(({ event }) => event === "execution.submitted")).toHaveLength(1);
      expect(events.filter(({ event }) => event === "execution.confirmed")).toHaveLength(1);
    }),
  );
});
