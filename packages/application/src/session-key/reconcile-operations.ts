import { DateTime, Duration, Effect, Metric, Option } from "effect";

import { CryptoService } from "@namera-ai/crypto";
import { Repository } from "@namera-ai/database";
import { Evm } from "@namera-ai/evm";
import type { SessionKeyOperation } from "@namera-ai/protocol/model";
import { sessionKeyOperationResults } from "@namera-ai/telemetry";

import { makeSettleSessionKeyOperation } from "./operation-receipt.js";

const reconciliation = {
  batchSize: 20,
  concurrency: 4,
  lease: Duration.minutes(2),
  retry: Duration.seconds(15),
} as const;

export const makeReconcileSessionKeyOperations = Effect.gen(function* () {
  const repository = yield* Repository;
  const crypto = yield* CryptoService;
  const evm = yield* Evm;
  const settle = yield* makeSettleSessionKeyOperation;

  const defer = Effect.fn("application.sessionKey.deferOperation")(function* (
    operation: SessionKeyOperation,
    leaseToken: string,
  ) {
    const now = yield* DateTime.now;
    yield* repository.core.sessionKeyOperation.releaseLease({
      id: operation.id,
      organizationId: operation.organizationId,
      leaseToken,
      now,
      nextReconcileAt: DateTime.addDuration(now, reconciliation.retry),
    });
  });

  const reconcileOne = Effect.fn("application.sessionKey.reconcileOperation")(function* (
    operation: SessionKeyOperation,
    leaseToken: string,
  ) {
    const signed = operation.data.signed;
    if (signed === null) return yield* Effect.die("Signed session operation lacks its envelope");
    const receipt = yield* evm.execution.getReceipt({
      chainId: signed.chainId,
      userOperationHash: signed.userOperationHash,
    });
    if (Option.isSome(receipt)) {
      yield* settle(operation, leaseToken, receipt.value);
      return;
    }
    // Resubmit exactly the persisted bytes, including after an ambiguous response
    // or bundler eviction. Never create a replacement or expire a signed approval.
    yield* evm.execution.submit({ signed });
    yield* repository.core.sessionKeyOperation.markSubmitted({
      id: operation.id,
      organizationId: operation.organizationId,
      leaseToken,
      now: yield* DateTime.now,
    });
    yield* defer(operation, leaseToken);
  });

  return Effect.fn("application.sessionKey.reconcileOperations")(
    function* () {
      const now = yield* DateTime.now;
      const expired = yield* repository.core.sessionKeyOperation.expireAwaitingSignatures({
        now,
        limit: reconciliation.batchSize,
      });
      if (expired.length > 0)
        yield* Metric.update(
          Metric.withAttributes(sessionKeyOperationResults, {
            stage: "reconcile",
            result: "expired",
          }),
          expired.length,
        );
      const leaseToken = yield* crypto.randomToken(24);
      const operations = yield* repository.core.sessionKeyOperation.claimForReconciliation({
        now,
        leaseToken,
        leaseExpiresAt: DateTime.addDuration(now, reconciliation.lease),
        limit: reconciliation.batchSize,
      });
      yield* Effect.forEach(
        operations,
        (operation) =>
          reconcileOne(operation, leaseToken).pipe(
            Effect.catchCause(() =>
              Effect.gen(function* () {
                // Provider errors may embed request URLs or signature payloads. Do not
                // serialize them into logs; retain the operation for a later retry.
                yield* Effect.logError("session_key.operation.reconciliation_failed").pipe(
                  Effect.annotateLogs({ operation_id: operation.id, kind: operation.kind }),
                );
                yield* Metric.update(
                  Metric.withAttributes(sessionKeyOperationResults, {
                    stage: "reconcile",
                    result: "retry",
                  }),
                  1,
                );
                yield* defer(operation, leaseToken);
              }),
            ),
          ),
        { concurrency: reconciliation.concurrency, discard: true },
      );
      return operations.length + expired.length;
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );
});
