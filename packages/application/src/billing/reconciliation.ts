import { DateTime, Effect, Metric, Schema } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import { Evm } from "@namera-ai/evm";
import {
  type BillingPeriodId,
  ExecutionSubmissionId,
  SignatureOperationId,
} from "@namera-ai/protocol";
import type { BillingUsageReservation } from "@namera-ai/protocol/model";
import { billingProjectionRepairs, billingRecoveryResults } from "@namera-ai/telemetry";

import { makeBillingMetering } from "./metering.js";
import { makeBillingPeriods } from "./periods.js";

const maintenanceBatchSize = 50;
const deferredReservationDelay = { minutes: 5 } as const;

export const makeBillingReconciliation = Effect.gen(function* () {
  const evm = yield* Evm;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const metering = yield* makeBillingMetering;
  const periods = yield* makeBillingPeriods;

  const recoverReservation = Effect.fnUntraced(function* (reservation: BillingUsageReservation) {
    // Owner-approved operations can be broadcast after an HTTP timeout. Their
    // receipt worker settles these holds; age alone must never release them.
    if (reservation.sourceType === "session-key-operation") return false;
    if (reservation.sourceType === "signature-operation") {
      const operation = yield* repository.core.signatureOperation.findByIdForUpdate(
        Schema.decodeUnknownSync(SignatureOperationId)(reservation.sourceId),
        reservation.organizationId,
        true,
      );
      // Expiry recovery already holds the billing row. Do not wait on an
      // operation lock held by completion, which settles in the opposite order.
      if (operation === undefined) return false;
      if (operation.status === "succeeded") {
        yield* metering.settle({
          organizationId: reservation.organizationId,
          reservationId: reservation.id,
          amount: 1n,
          data: { version: 1, namespace: operation.namespace, recovered: true },
        });
        return true;
      }
      if (
        operation.status === "reserved" &&
        DateTime.toEpochMillis(operation.reservationExpiresAt) <=
          DateTime.toEpochMillis(yield* DateTime.now)
      ) {
        yield* repository.core.signatureOperation.markFailed({
          id: operation.id,
          organizationId: operation.organizationId,
          failureCode: "PREPARATION_EXPIRED",
          failedAt: yield* DateTime.now,
        });
      } else if (operation.status !== "failed") return false;
      yield* metering.release({
        organizationId: reservation.organizationId,
        reservationId: reservation.id,
        status: "expired",
      });
      return true;
    }

    if (reservation.sourceType === "execution-submission") {
      const submission = yield* repository.core.executionSubmission.findByIdForUpdate(
        Schema.decodeUnknownSync(ExecutionSubmissionId)(reservation.sourceId),
        reservation.organizationId,
        true,
      );
      // Settlement locks the submission before billing. Recovery already holds
      // the reservation, so skip busy submissions instead of reversing that order.
      // A skipped (or missing) row is not evidence that the operation failed.
      if (submission === undefined) return false;
      if (submission.status === "failed") {
        yield* metering.release({
          organizationId: reservation.organizationId,
          reservationId: reservation.id,
          status: "expired",
        });
        return true;
      }
      if (submission.status !== "confirmed") return false;

      const execution = yield* repository.core.execution.findBySubmissionId(
        submission.id,
        submission.organizationId,
      );
      if (execution === undefined || execution.namespace !== "eip155") return false;
      const signed = submission.data.signedExecution;
      if (reservation.meterKey === "gas-sponsorship" && signed === null) return false;
      const amount =
        reservation.meterKey === "gas-sponsorship" && signed !== null
          ? evm.billing.settleGasSponsorship({
              billing: signed.billing,
              receipt: execution.data.receipt,
            })
          : 1n;
      yield* metering.settle({
        organizationId: reservation.organizationId,
        reservationId: reservation.id,
        amount,
        data: {
          version: 1,
          namespace: "eip155",
          chainId: execution.data.chainId,
          transactionHash: execution.data.transactionHash,
          recovered: true,
        },
      });
      return true;
    }

    yield* metering.release({
      organizationId: reservation.organizationId,
      reservationId: reservation.id,
      status: "expired",
    });
    return true;
  });

  const recoverExpired = Effect.fn("application.billing.recoverExpired")(function* () {
    return yield* transaction.run(
      Effect.gen(function* () {
        const expired = yield* repository.billing.usageReservation.claimExpired(
          yield* DateTime.now,
          maintenanceBatchSize,
        );
        let recovered = 0;
        for (const reservation of expired) {
          if (yield* recoverReservation(reservation)) {
            recovered += 1;
            yield* Metric.update(
              Metric.withAttributes(billingRecoveryResults, {
                source: reservation.sourceType,
                outcome: "recovered",
              }),
              1,
            );
          } else {
            yield* repository.billing.usageReservation.deferExpiry(
              reservation.organizationId,
              reservation.id,
              DateTime.add(yield* DateTime.now, deferredReservationDelay),
            );
            yield* Metric.update(
              Metric.withAttributes(billingRecoveryResults, {
                source: reservation.sourceType,
                outcome: "deferred",
              }),
              1,
            );
          }
        }
        return recovered;
      }),
    );
  });

  const reconcileProjections = Effect.fn("application.billing.reconcileProjections")(function* () {
    let repaired = 0;
    let afterId: BillingPeriodId | undefined;
    while (true) {
      const open = yield* repository.billing.period.listOpen(maintenanceBatchSize, afterId);
      if (open.length === 0) break;
      for (const period of open) {
        repaired += yield* transaction.run(
          Effect.gen(function* () {
            const balances = yield* repository.billing.meterBalance.listForPeriod(
              period.organizationId,
              period.id,
            );
            let periodRepairs = 0;
            for (const balance of balances) {
              // Serialize projection repair with reserve/settle updates. Without
              // this lock a reconciliation read could overwrite a concurrent
              // transition with a stale aggregate.
              const locked = yield* repository.billing.meterBalance.findForUpdate(
                period.organizationId,
                period.id,
                balance.meterKey,
              );
              if (locked === undefined) continue;
              const consumed = yield* repository.billing.usageEvent.getNetAmount(
                period.organizationId,
                period.id,
                locked.meterKey,
              );
              const reserved = yield* repository.billing.usageReservation.sumActiveForMeter(
                period.organizationId,
                period.id,
                locked.meterKey,
              );
              if (consumed === locked.consumedAmount && reserved === locked.reservedAmount)
                continue;
              const updated = yield* repository.billing.meterBalance.replaceProjection(
                period.organizationId,
                period.id,
                locked.meterKey,
                consumed,
                reserved,
              );
              if (updated === undefined) {
                return yield* Effect.die(
                  "Billing projection reconciliation exceeded its hard limit",
                );
              }
              periodRepairs += 1;
              yield* Metric.update(
                Metric.withAttributes(billingProjectionRepairs, { meter: locked.meterKey }),
                1,
              );
            }
            return periodRepairs;
          }),
        );
      }
      afterId = open.at(-1)?.id;
      if (open.length < maintenanceBatchSize || afterId === undefined) break;
    }
    return repaired;
  });

  const run = Effect.fn("application.billing.reconcile")(function* () {
    const rolledOver = yield* periods.rolloverExpired(maintenanceBatchSize);
    const recovered = yield* recoverExpired();
    const repaired = yield* reconcileProjections();
    return { rolledOver, recovered, repaired };
  });

  return { run } as const;
});
