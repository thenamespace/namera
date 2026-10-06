import { DateTime, Effect, Metric, Option, Schema } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import { Evm, isReceiptForEvmExecution } from "@namera-ai/evm";
import {
  ExecutionSubmissionId,
  SessionKeyOperationId,
  type EvmSignedExecution,
  type EvmExecutionReceipt,
} from "@namera-ai/protocol";
import type { BillingUsageReservation } from "@namera-ai/protocol/model";
import { billingRecoveryResults } from "@namera-ai/telemetry";

import { makeBillingMetering } from "./metering.js";

export const makeSponsorshipReconciliation = Effect.gen(function* () {
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const evm = yield* Evm;
  const metering = yield* makeBillingMetering;

  const recover = Effect.fn("application.billing.reconcileSponsorship")(function* (
    reservation: BillingUsageReservation,
  ) {
    let signed: EvmSignedExecution | null = null;
    let evidence:
      | Pick<EvmExecutionReceipt, "chainId" | "userOperationHash" | "transactionHash" | "sender">
      | undefined;
    if (reservation.sourceType === "session-key-operation") {
      const operation = yield* repository.core.sessionKeyOperation.findById({
        organizationId: reservation.organizationId,
        id: Schema.decodeUnknownSync(SessionKeyOperationId)(reservation.sourceId),
      });
      if (
        operation === undefined ||
        operation.transactionHash === null ||
        (operation.status !== "confirmed" && operation.status !== "failed")
      )
        return false;
      signed = operation.data.signed;
      if (signed !== null && signed.chainId === operation.chainId)
        evidence = {
          chainId: operation.chainId,
          userOperationHash: signed.userOperationHash,
          transactionHash: operation.transactionHash,
          sender: signed.userOperation.sender,
        };
    } else if (reservation.sourceType === "execution-submission") {
      const submission = yield* repository.core.executionSubmission.findById(
        Schema.decodeUnknownSync(ExecutionSubmissionId)(reservation.sourceId),
        reservation.organizationId,
      );
      if (
        submission === undefined ||
        (submission.status !== "confirmed" && submission.status !== "failed")
      )
        return false;
      signed = submission.data.signedExecution;
      if (submission.status === "confirmed" && signed !== null) {
        const execution = yield* repository.core.execution.findBySubmissionId(
          submission.id,
          submission.organizationId,
        );
        if (execution !== undefined && isReceiptForEvmExecution(signed, execution.data.receipt))
          evidence = execution.data.receipt;
      }
    }
    if (signed === null || signed.billing.sponsorship === null) return false;
    // Failed submissions do not persist a receipt. Bind a fresh chain receipt to
    // the immutable signed operation before trusting any provider billing record.
    if (evidence === undefined) {
      const receipt = yield* evm.execution.getReceipt({
        chainId: signed.chainId,
        userOperationHash: signed.userOperationHash,
      });
      if (Option.isNone(receipt) || !isReceiptForEvmExecution(signed, receipt.value)) return false;
      evidence = receipt.value;
    }
    const cost = yield* evm.billing.getGasSponsorshipCost(evidence);
    if (Option.isNone(cost)) return false;
    if (cost.value.amountMicroUsd > reservation.amount) {
      yield* Effect.logWarning("billing.sponsorship_cost_exceeds_reservation").pipe(
        Effect.annotateLogs({ reservation_id: reservation.id }),
      );
      return false;
    }
    yield* metering.settle({
      organizationId: reservation.organizationId,
      reservationId: reservation.id,
      amount: cost.value.amountMicroUsd,
      data: {
        version: 1,
        namespace: "eip155",
        provider: "alchemy",
        costBasis: "confirmedTotalUsd",
        chainId: evidence.chainId,
        userOperationHash: evidence.userOperationHash,
        transactionHash: evidence.transactionHash,
        confirmedTotalUsd: cost.value.confirmedTotalUsd,
      },
    });
    return true;
  });

  return Effect.fn("application.billing.reconcileSponsorships")(function* () {
    const reservations = yield* transaction.run(
      Effect.gen(function* () {
        const now = yield* DateTime.now;
        const claimed = yield* repository.billing.usageReservation.claimSponsorships(now, 20);
        for (const reservation of claimed) {
          yield* repository.billing.usageReservation.deferExpiry(
            reservation.organizationId,
            reservation.id,
            DateTime.add(now, { minutes: 5 }),
          );
        }
        return claimed;
      }),
    );
    // Network I/O must not hold database locks. The reservation lock and unique
    // ledger key in settle make overlapping/expired claims safe to retry.
    const results = yield* Effect.forEach(
      reservations,
      (reservation) =>
        recover(reservation).pipe(
          Effect.catchTag("SponsorshipCostError", (error) =>
            Effect.logWarning("billing.sponsorship_lookup_failed").pipe(
              Effect.annotateLogs({ reason: error.code }),
              Effect.as(false),
            ),
          ),
          Effect.catchTag(["EvmExecutionError", "UnsupportedChainError"], () =>
            Effect.logWarning("billing.sponsorship_receipt_unavailable").pipe(Effect.as(false)),
          ),
          Effect.tap((recovered) =>
            Metric.update(
              Metric.withAttributes(billingRecoveryResults, {
                source: reservation.sourceType,
                outcome: recovered ? "sponsorship_settled" : "sponsorship_deferred",
              }),
              1,
            ),
          ),
        ),
      { concurrency: 2 },
    );
    return results.filter(Boolean).length;
  });
});
