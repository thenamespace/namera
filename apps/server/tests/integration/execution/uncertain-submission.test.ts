import { expect, layer } from "@effect/vitest";
import { Effect, Option } from "effect";
import { TestClock } from "effect/testing";

import { makeTestEvmExecutionService, TestEvmExecution } from "@namera-ai/evm";
import { EthereumAddress, EvmExecutionError, Hex, UserOperationHash } from "@namera-ai/protocol";

import { queueRecoveryExecution } from "../../fixtures/execution-recovery.js";
import { resetTestState, setApiKey, setAuthToken } from "../../fixtures/index.js";
import { makeOwnerSessionTestFixture } from "../../fixtures/owner-session.js";

for (const { status, receiptEvidence } of [
  { status: "reverted", receiptEvidence: "matched" },
  { status: "failed", receiptEvidence: "matched" },
  { status: "included", receiptEvidence: "matched" },
  { status: "included", receiptEvidence: "mismatched" },
  { status: "failed", receiptEvidence: "mismatched" },
  { status: "submitted", receiptEvidence: "missing" },
  { status: "included", receiptEvidence: "missing" },
] as const) {
  const unresolved = receiptEvidence !== "matched";
  const provider = makeTestEvmExecutionService();
  const operationHash = UserOperationHash.make(`0x${"55".repeat(32)}`);
  const fixture = makeOwnerSessionTestFixture({
    sessionSigningMessage: () => Effect.succeed(Hex.make(`0x${"22".repeat(32)}`)),
    completeSessionExecution: (input) =>
      provider
        .sign(input)
        .pipe(Effect.map((signed) => ({ ...signed, userOperationHash: operationHash }))),
    submit: Effect.fnUntraced(function* (input) {
      if (input.signed.userOperationHash === operationHash) {
        yield* provider.submit(input);
        return yield* new EvmExecutionError({
          code: "SUBMISSION_UNKNOWN",
          cause: "Lost submission response",
        });
      }
      return yield* provider.submit(input);
    }),
    getStatus: () => Effect.succeed({ status, transactionHash: null }),
    getReceipt: Effect.fnUntraced(function* (input) {
      if (input.userOperationHash === operationHash && receiptEvidence === "missing")
        return Option.none();
      const receipt = yield* provider.getReceipt(input);
      return Option.map(receipt, (value) => {
        const normalized = {
          ...value,
          sender: EthereumAddress.make("0x3333333333333333333333333333333333333333"),
        };
        return input.userOperationHash === operationHash
          ? {
              ...normalized,
              nonce: receiptEvidence === "mismatched" ? value.nonce + 1n : value.nonce,
              ...(status === "included"
                ? { success: true as const, reason: null }
                : { success: false as const, reason: "Execution reverted" }),
            }
          : normalized;
      });
    }),
  });

  layer(fixture.layer)(
    `uncertain submission followed by ${status}, receipt=${receiptEvidence}`,
    (it) => {
      it.effect(
        "settles only a matching receipt and preserves holds without conclusive evidence",
        () =>
          Effect.gen(function* () {
            yield* resetTestState();
            const {
              client,
              owner,
              queued,
              app,
              repository,
              billingBefore: before,
            } = yield* queueRecoveryExecution(fixture, `uncertain-${status}`);
            const execution = yield* TestEvmExecution;
            const sendsBefore = yield* execution.submissionCount;
            yield* TestClock.adjust("2 seconds");
            expect(yield* app.execution.reconcile()).toBe(1);
            expect(
              yield* client.execution.getSubmission({
                params: { submissionId: queued.submissionId },
              }),
            ).toMatchObject({ status: "submitted" });
            yield* TestClock.adjust("16 seconds");
            expect(yield* app.execution.reconcile()).toBe(1);
            expect(
              yield* client.execution.getSubmission({
                params: { submissionId: queued.submissionId },
              }),
            ).toMatchObject({
              status: unresolved ? "submitted" : status === "included" ? "confirmed" : "failed",
            });
            expect(yield* app.execution.reconcile()).toBe(0);
            expect(yield* execution.submissionCount).toBe(sendsBefore + 1);
            yield* setApiKey();
            yield* setAuthToken(owner.cookie.value);
            yield* app.billing.reconcile();
            const after = yield* client.billing.get();
            expect(after.meters.find(({ key }) => key === "execution.mainnet")).toMatchObject({
              consumedAmount:
                (before.meters.find(({ key }) => key === "execution.mainnet")?.consumedAmount ??
                  0n) + (status === "included" && !unresolved ? 1n : 0n),
              reservedAmount: unresolved ? 1n : 0n,
            });
            expect(after.meters.find(({ key }) => key === "gas-sponsorship")).toMatchObject({
              consumedAmount:
                (before.meters.find(({ key }) => key === "gas-sponsorship")?.consumedAmount ?? 0n) +
                (unresolved ? 0n : 32_400n),
              reservedAmount: unresolved ? 100_000n : 0n,
            });
            const events = yield* repository.audit.organization.findForOrganization(
              owner.actor.organization.id,
            );
            expect(events.filter(({ event }) => event === "execution.confirmed")).toHaveLength(
              status === "included" && !unresolved ? 1 : 0,
            );
          }),
      );
    },
  );
}
