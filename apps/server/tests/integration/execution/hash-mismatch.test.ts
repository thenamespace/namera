import { expect, layer } from "@effect/vitest";
import { Clock, Context, Effect, Option, Schema } from "effect";
import { TestClock } from "effect/testing";

import { Database, executionSubmission } from "@namera-ai/database";
import { makeTestEvmExecutionService } from "@namera-ai/evm";
import { EthereumAddress, EvmExecutionError, Hex, UserOperationHash } from "@namera-ai/protocol";
import { EvmExecutionSubmissionData } from "@namera-ai/protocol/model";

import { queueRecoveryExecution } from "../../fixtures/execution-recovery.js";
import { resetTestState } from "../../fixtures/index.js";
import { makeOwnerSessionTestFixture } from "../../fixtures/owner-session.js";

const receiptVisible = Context.Reference<boolean>("test/hashMismatch/receiptVisible", {
  defaultValue: () => false,
});
const forbidBroadcast = Context.Reference<boolean>("test/hashMismatch/forbidBroadcast", {
  defaultValue: () => false,
});
const operationHash = UserOperationHash.make(`0x${"55".repeat(32)}`);
const provider = makeTestEvmExecutionService();
const fixture = makeOwnerSessionTestFixture({
  sessionSigningMessage: () => Effect.succeed(Hex.make(`0x${"22".repeat(32)}`)),
  completeSessionExecution: (input) =>
    provider
      .sign(input)
      .pipe(Effect.map((signed) => ({ ...signed, userOperationHash: operationHash }))),
  submit: Effect.fnUntraced(function* (input) {
    if (input.signed.userOperationHash !== operationHash) return yield* provider.submit(input);
    if (yield* forbidBroadcast) return yield* Effect.die("Unexpected rebroadcast");
    return yield* new EvmExecutionError({
      code: "SUBMISSION_HASH_MISMATCH",
      cause: "Provider accepted the operation but returned a different hash",
    });
  }),
  getStatus: Effect.fnUntraced(function* () {
    return {
      status: (yield* receiptVisible)
        ? ("included" as const)
        : (yield* forbidBroadcast)
          ? ("rejected" as const)
          : ("not_found" as const),
      transactionHash: null,
    };
  }),
  getReceipt: Effect.fnUntraced(function* (input) {
    if (input.userOperationHash === operationHash && !(yield* receiptVisible)) return Option.none();
    return yield* provider.getReceipt(input).pipe(
      Effect.map((receipt) =>
        Option.map(receipt, (value) => ({
          ...value,
          sender: EthereumAddress.make("0x3333333333333333333333333333333333333333"),
        })),
      ),
    );
  }),
});

layer(fixture.layer)("mismatched submission response", (it) => {
  for (const legacy of [false, true]) {
    it.effect(
      `retains uncertain holds without rebroadcast and settles once; legacy=${legacy}`,
      () =>
        Effect.gen(function* () {
          yield* resetTestState();
          yield* TestClock.setTime(yield* TestClock.withLive(Clock.currentTimeMillis));
          const { client, owner, queued, repository, app } = yield* queueRecoveryExecution(
            fixture,
            "hash-mismatch",
          );
          yield* TestClock.adjust("2 seconds");
          expect(yield* app.execution.reconcile()).toBe(1);
          expect(
            yield* client.execution.getSubmission({
              params: { submissionId: queued.submissionId },
            }),
          ).toMatchObject({ status: "prepared" });
          const holds = yield* repository.billing.usageReservation.listBySource(
            owner.actor.organization.id,
            "execution-submission",
            queued.submissionId,
          );
          expect(holds).toHaveLength(2);
          expect(holds.every((hold) => hold.status === "active")).toBe(true);
          expect(yield* app.execution.reconcile()).toBe(0);

          if (legacy) {
            const stored = yield* repository.core.executionSubmission.findById(
              queued.submissionId,
              owner.actor.organization.id,
            );
            if (!stored) return yield* Effect.die("Missing submission");
            const { broadcastAttempted: _attempted, ...data } = stored.data;
            // This isolated fixture contains exactly one delegated submission.
            yield* (yield* Database).update(executionSubmission).set({
              data: Schema.encodeSync(EvmExecutionSubmissionData)(data),
            });
          }

          yield* TestClock.adjust("16 seconds");
          expect(
            yield* app.execution.reconcile().pipe(Effect.provideService(forbidBroadcast, true)),
          ).toBe(1);
          expect(
            yield* repository.core.executionSubmission.findById(
              queued.submissionId,
              owner.actor.organization.id,
            ),
          ).toMatchObject({ status: "prepared" });
          expect(
            (yield* repository.billing.usageReservation.listBySource(
              owner.actor.organization.id,
              "execution-submission",
              queued.submissionId,
            )).every((hold) => hold.status === "active"),
          ).toBe(true);

          yield* TestClock.adjust("24 hours");
          expect(
            yield* app.execution.reconcile().pipe(Effect.provideService(forbidBroadcast, true)),
          ).toBe(1);
          expect(
            (yield* repository.billing.usageReservation.listBySource(
              owner.actor.organization.id,
              "execution-submission",
              queued.submissionId,
            )).every((hold) => hold.status === "active"),
          ).toBe(true);
          yield* TestClock.adjust("16 seconds");
          expect(yield* app.execution.reconcile()).toBe(0);
          yield* TestClock.adjust("5 minutes");
          expect(
            yield* app.execution
              .reconcile()
              .pipe(
                Effect.provideService(receiptVisible, true),
                Effect.provideService(forbidBroadcast, true),
              ),
          ).toBe(1);
          expect(
            yield* client.execution.getSubmission({
              params: { submissionId: queued.submissionId },
            }),
          ).toMatchObject({ status: "submitted" });
          yield* TestClock.adjust("16 seconds");
          expect(
            yield* app.execution.reconcile().pipe(Effect.provideService(receiptVisible, true)),
          ).toBe(1);
          expect(
            yield* client.execution.getSubmission({
              params: { submissionId: queued.submissionId },
            }),
          ).toMatchObject({ status: "confirmed" });
          expect(yield* app.execution.reconcile()).toBe(0);
          expect(yield* app.billing.reconcile()).toMatchObject({ recovered: 1 });
          expect(
            (yield* repository.billing.usageReservation.listBySource(
              owner.actor.organization.id,
              "execution-submission",
              queued.submissionId,
            )).every((hold) => hold.status === "settled"),
          ).toBe(true);
          const events = yield* repository.audit.organization.findForOrganization(
            owner.actor.organization.id,
          );
          expect(events.filter((event) => event.event === "execution.confirmed")).toHaveLength(1);
          expect(events.filter((event) => event.event === "execution.failed")).toHaveLength(0);
        }),
    );
  }
});
