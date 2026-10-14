import { Cause, DateTime, Duration, Effect, Metric, Option, Predicate, Result } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import { Evm, isReceiptForEvmExecution } from "@namera-ai/evm";
import type { WalletOperation } from "@namera-ai/protocol/model";
import { workerBacklog, workerOldestAge } from "@namera-ai/telemetry";
import { generateUniqueId } from "@namera-ai/utils";

import { Audit } from "#/audit/layer";
import { lockOrganizationBilling } from "#/billing/lock";
import { makeBillingMetering } from "#/billing/metering";

export const makeReconcileWalletTransactions = Effect.gen(function* () {
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const evm = yield* Evm;
  const billing = yield* makeBillingMetering;
  const audit = yield* Audit;
  const reject = Effect.fn("application.wallet.transactions.reject")(function* (
    operation: WalletOperation,
    leaseToken: string,
  ) {
    yield* transaction.run(
      Effect.gen(function* () {
        yield* lockOrganizationBilling(repository, operation.organizationId);
        yield* repository.core.wallet.findByIdForUpdate(
          operation.walletId,
          operation.organizationId,
        );
        const finished = yield* repository.core.walletOperation.rejectSubmission({
          id: operation.id,
          organizationId: operation.organizationId,
          leaseToken,
          now: yield* DateTime.now,
        });
        if (!finished) return;
        const reservations = yield* repository.billing.usageReservation.listBySource(
          operation.organizationId,
          "wallet-operation",
          operation.id,
        );
        for (const reservation of reservations)
          yield* billing.release({
            organizationId: operation.organizationId,
            reservationId: reservation.id,
          });
        yield* audit.organization({
          organizationId: operation.organizationId,
          actorId: operation.actorId,
          event: "wallet.operation_failed",
          resourceType: "wallet",
          resourceId: operation.walletId,
          data: { version: 1, operationId: operation.id, kind: operation.kind },
        });
      }),
    );
  });
  const reconcile = Effect.fn("application.wallet.transactions.reconcile")(function* (
    operation: WalletOperation,
    leaseToken: string,
  ) {
    const signed = operation.data.signed;
    if (!signed) return yield* Effect.die("Signed wallet operation lacks its envelope");
    const receipt = yield* evm.execution.getReceipt({
      chainId: signed.chainId,
      userOperationHash: signed.userOperationHash,
    });
    if (Option.isNone(receipt)) {
      const scope = { id: operation.id, organizationId: operation.organizationId, leaseToken };
      const lookup = { chainId: signed.chainId, userOperationHash: signed.userOperationHash };
      const status = yield* evm.execution.getStatus(lookup);
      if (status.status === "rejected") {
        yield* reject(operation, leaseToken);
        return;
      }
      if (status.status !== "not_found" && status.status !== "not_submitted") {
        yield* repository.core.walletOperation.markSubmitted({
          ...scope,
          now: yield* DateTime.now,
        });
        return;
      }
      const aged = DateTime.isGreaterThanOrEqualTo(
        yield* DateTime.now,
        DateTime.addDuration(operation.createdAt, Duration.hours(24)),
      );
      if (operation.data.submissionBlocked || aged || operation.status === "submitted") return;
      // The durable marker precedes RPC, so crashes and lost responses cannot be mistaken for first sends.
      const attempt = yield* repository.core.walletOperation.recordBroadcastAttempt({
        ...scope,
        now: yield* DateTime.now,
      });
      if (!attempt) return;
      const submitted = yield* evm.execution.submit({ signed }).pipe(Effect.result);
      if (Result.isSuccess(submitted)) {
        yield* repository.core.walletOperation.markSubmitted({
          ...scope,
          now: yield* DateTime.now,
        });
        return;
      }
      if (
        Predicate.isTagged(submitted.failure, "EvmExecutionError") &&
        submitted.failure.code === "SUBMISSION_REJECTED"
      ) {
        // Stop automatic rebroadcast even if status lookup fails. Prior/legacy sends may still settle.
        yield* repository.core.walletOperation.blockSubmission({
          ...scope,
          now: yield* DateTime.now,
        });
        const observed = yield* evm.execution.getStatus(lookup);
        if (
          operation.data.broadcastAttempted === false &&
          (observed.status === "not_found" || observed.status === "not_submitted")
        )
          yield* reject(operation, leaseToken);
        yield* Effect.logWarning("wallet.operation.submission_rejected").pipe(
          Effect.annotateLogs({
            operation_id: operation.id,
            reason:
              operation.data.broadcastAttempted === false
                ? "first_attempt_rejected"
                : "prior_submission_uncertain",
          }),
        );
        return;
      }
      yield* Effect.logWarning("wallet.operation.submission_deferred").pipe(
        Effect.annotateLogs({
          operation_id: operation.id,
          reason: Predicate.isTagged(submitted.failure, "EvmExecutionError")
            ? submitted.failure.code
            : "unsupported_chain",
        }),
      );
      return;
    }
    if (!isReceiptForEvmExecution(signed, receipt.value))
      return yield* Effect.die("Mismatched wallet operation receipt");
    const confirmed = receipt.value;
    yield* transaction.run(
      Effect.gen(function* () {
        yield* lockOrganizationBilling(repository, operation.organizationId);
        yield* repository.core.wallet.findByIdForUpdate(
          operation.walletId,
          operation.organizationId,
        );
        const finished = yield* repository.core.walletOperation.finishReceipt({
          id: operation.id,
          organizationId: operation.organizationId,
          leaseToken,
          now: yield* DateTime.now,
          userOperationHash: confirmed.userOperationHash,
          transactionHash: confirmed.transactionHash,
          success: confirmed.success,
        });
        if (!finished) return;
        const reservations = yield* repository.billing.usageReservation.listBySource(
          operation.organizationId,
          "wallet-operation",
          operation.id,
        );
        for (const reservation of reservations) {
          if (reservation.meterKey === "gas-sponsorship") {
            yield* repository.billing.usageReservation.deferExpiry(
              operation.organizationId,
              reservation.id,
              yield* DateTime.now,
            );
            continue;
          }
          yield* billing.settle({
            organizationId: operation.organizationId,
            reservationId: reservation.id,
            amount: 1n,
            data: { version: 1, namespace: "eip155" },
          });
        }
        yield* audit.organization({
          organizationId: operation.organizationId,
          actorId: operation.actorId,
          event: confirmed.success ? "wallet.operation_confirmed" : "wallet.operation_failed",
          resourceType: "wallet",
          resourceId: operation.walletId,
          data: { version: 1, operationId: operation.id, kind: operation.kind },
        });
      }),
    );
  });
  return Effect.fnUntraced(
    function* () {
      const now = yield* DateTime.now;
      const backlog = yield* repository.core.walletOperation.getBacklog(now);
      yield* Metric.update(
        Metric.withAttributes(workerBacklog, { worker: "wallet_operation" }),
        backlog.count,
      );
      yield* Metric.update(
        Metric.withAttributes(workerOldestAge, { worker: "wallet_operation" }),
        backlog.oldestAgeSeconds,
      );
      yield* Effect.gen(function* () {
        const expired = yield* repository.core.walletOperation.expireAwaitingSignatures({
          now,
          limit: 20,
        });
        for (const operation of expired) {
          const reservations = yield* repository.billing.usageReservation.listBySource(
            operation.organizationId,
            "wallet-operation",
            operation.id,
          );
          for (const reservation of reservations)
            yield* billing.release({
              organizationId: operation.organizationId,
              reservationId: reservation.id,
              status: "expired",
            });
        }
      });
      const leaseToken = generateUniqueId();
      const operations = yield* repository.core.walletOperation.claimForReconciliation({
        now,
        leaseToken,
        leaseExpiresAt: DateTime.addDuration(now, Duration.minutes(2)),
        limit: 20,
      });
      yield* Effect.forEach(
        operations,
        (operation) =>
          Effect.gen(function* () {
            yield* reconcile(operation, leaseToken).pipe(
              Effect.catchCause((cause) => {
                if (Cause.hasInterruptsOnly(cause)) return Effect.failCause(cause);
                const error = Option.getOrUndefined(Cause.findErrorOption(cause));
                const errorType =
                  ["EvmExecutionError", "DatabaseError", "UnsupportedChainError"].find((tag) =>
                    Predicate.isTagged(error, tag),
                  ) ?? "unknown";
                // Never log raw causes: RPC errors can contain credentials and signed operations.
                return Effect.logError("wallet.operation.reconciliation_failed").pipe(
                  Effect.annotateLogs({
                    operation_id: operation.id,
                    operation_status: operation.status,
                    chain_id: operation.chainId,
                    error_type: Cause.hasDies(cause) ? "defect" : errorType,
                    error_code: Predicate.isTagged(error, "EvmExecutionError")
                      ? error.code
                      : "unknown",
                    response_decode_failed:
                      Predicate.isTagged(error, "EvmExecutionError") &&
                      Predicate.isTagged(error.cause, "SchemaError"),
                  }),
                );
              }),
            );
            const completedAt = yield* DateTime.now;
            const latest = yield* repository.core.walletOperation.findById({
              id: operation.id,
              organizationId: operation.organizationId,
            });
            const slow =
              latest?.data.submissionBlocked ||
              DateTime.isGreaterThanOrEqualTo(
                completedAt,
                DateTime.addDuration(operation.createdAt, Duration.hours(24)),
              );
            yield* repository.core.walletOperation.releaseLease({
              id: operation.id,
              organizationId: operation.organizationId,
              leaseToken,
              now: completedAt,
              nextReconcileAt: DateTime.addDuration(
                completedAt,
                slow ? Duration.minutes(5) : Duration.seconds(15),
              ),
            });
          }),
        { concurrency: 4, discard: true },
      );
      return operations.length;
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );
});
