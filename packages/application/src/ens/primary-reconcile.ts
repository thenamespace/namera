import { DateTime, Duration, Effect, Metric, Option } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import { Evm, isReceiptForEvmExecution } from "@namera-ai/evm";
import type { WalletOperation } from "@namera-ai/protocol/model";
import { workerBacklog, workerOldestAge } from "@namera-ai/telemetry";
import { generateUniqueId } from "@namera-ai/utils";

import { Audit } from "#/audit/layer";
import { makeBillingMetering } from "#/billing/metering";

export const makeReconcileIdentityPrimary = Effect.gen(function* () {
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const evm = yield* Evm;
  const billing = yield* makeBillingMetering;
  const audit = yield* Audit;
  const reconcile = Effect.fn("application.ens.reconcilePrimary")(function* (
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
      // Retrying sends the same signed bytes, never a replacement transaction.
      yield* evm.execution.submit({ signed });
      yield* repository.core.walletOperation.markSubmitted({
        id: operation.id,
        organizationId: operation.organizationId,
        leaseToken,
        now: yield* DateTime.now,
      });
      return;
    }
    if (!isReceiptForEvmExecution(signed, receipt.value))
      return yield* Effect.die("Mismatched wallet operation receipt");
    const confirmed = receipt.value;
    yield* transaction.run(
      Effect.gen(function* () {
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
        for (const reservation of reservations)
          yield* billing.settle({
            organizationId: operation.organizationId,
            reservationId: reservation.id,
            amount: 1n,
            data: { version: 1, namespace: "eip155" },
          });
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
      yield* repository.core.walletOperation.expireAwaitingSignatures({ now, limit: 20 });
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
              Effect.catchCause(() =>
                Effect.logError("wallet.operation.reconciliation_failed").pipe(
                  Effect.annotateLogs({ operation_id: operation.id }),
                ),
              ),
            );
            const completedAt = yield* DateTime.now;
            yield* repository.core.walletOperation.releaseLease({
              id: operation.id,
              organizationId: operation.organizationId,
              leaseToken,
              now: completedAt,
              nextReconcileAt: DateTime.addDuration(completedAt, Duration.seconds(15)),
            });
          }),
        { concurrency: 4, discard: true },
      );
      return operations.length;
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );
});
