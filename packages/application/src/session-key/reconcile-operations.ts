import { Cause, DateTime, Duration, Effect, Metric, Option, Predicate, Result } from "effect";

import { CryptoService } from "@namera-ai/crypto";
import { Repository } from "@namera-ai/database";
import { Evm } from "@namera-ai/evm";
import type { SessionKeyOperation } from "@namera-ai/protocol/model";
import { sessionKeyOperationResults, workerBacklog, workerOldestAge } from "@namera-ai/telemetry";

import { makeSettleSessionKeyOperation } from "./operation-receipt.js";
import { makeRejectSessionKeySubmission } from "./reject-submission.js";

const reconciliation = {
  batchSize: 4,
  concurrency: 4,
  lease: Duration.minutes(2),
  retry: Duration.seconds(15),
} as const;

export const makeReconcileSessionKeyOperations = Effect.gen(function* () {
  const repository = yield* Repository;
  const crypto = yield* CryptoService;
  const evm = yield* Evm;
  const settle = yield* makeSettleSessionKeyOperation;
  const reject = yield* makeRejectSessionKeySubmission;

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
      nextReconcileAt: DateTime.addDuration(
        now,
        DateTime.isGreaterThanOrEqualTo(
          now,
          DateTime.addDuration(operation.createdAt, Duration.hours(24)),
        )
          ? Duration.minutes(5)
          : reconciliation.retry,
      ),
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
    // Signed/unknown legacy operations may already be pending. Never resend them.
    const aged = DateTime.isGreaterThanOrEqualTo(
      yield* DateTime.now,
      DateTime.addDuration(operation.createdAt, Duration.hours(24)),
    );
    if (operation.status !== "signed" || operation.data.broadcastAttempted !== false || aged) {
      yield* defer(operation, leaseToken);
      return;
    }
    const scope = { id: operation.id, organizationId: operation.organizationId, leaseToken };
    const attempt = yield* repository.core.sessionKeyOperation.recordBroadcastAttempt({
      ...scope,
      now: yield* DateTime.now,
    });
    if (!attempt) return;
    const submitted = yield* evm.execution.submit({ signed }).pipe(Effect.result);
    if (Result.isSuccess(submitted)) {
      yield* repository.core.sessionKeyOperation.markSubmitted({
        ...scope,
        now: yield* DateTime.now,
      });
    } else if (
      Predicate.isTagged(submitted.failure, "EvmExecutionError") &&
      submitted.failure.code === "SUBMISSION_REJECTED"
    ) {
      const observed = yield* evm.execution.getStatus({
        chainId: signed.chainId,
        userOperationHash: signed.userOperationHash,
      });
      if (
        observed.status === "not_found" ||
        observed.status === "not_submitted" ||
        observed.status === "rejected"
      ) {
        yield* reject(operation, leaseToken);
        return;
      }
      yield* repository.core.sessionKeyOperation.markSubmitted({
        ...scope,
        now: yield* DateTime.now,
      });
    }
    yield* defer(operation, leaseToken);
  });

  return Effect.fnUntraced(
    function* () {
      const now = yield* DateTime.now;
      const backlog = yield* repository.core.sessionKeyOperation.getBacklog(now);
      yield* Metric.update(
        Metric.withAttributes(workerBacklog, { worker: "session_key" }),
        backlog.count,
      );
      yield* Metric.update(
        Metric.withAttributes(workerOldestAge, { worker: "session_key" }),
        backlog.oldestAgeSeconds,
      );
      const expired = yield* repository.core.sessionKeyOperation
        .expireAwaitingSignatures({
          now,
          limit: reconciliation.batchSize,
        })
        .pipe(Effect.withTracerEnabled(false));
      if (expired.length > 0)
        yield* Metric.update(
          Metric.withAttributes(sessionKeyOperationResults, {
            stage: "reconcile",
            result: "expired",
          }),
          expired.length,
        );
      const leaseToken = yield* crypto.randomToken(24);
      const operations = yield* repository.core.sessionKeyOperation
        .claimForReconciliation({
          now,
          leaseToken,
          leaseExpiresAt: DateTime.addDuration(now, reconciliation.lease),
          limit: reconciliation.batchSize,
        })
        .pipe(Effect.withTracerEnabled(false));
      yield* Effect.forEach(
        operations,
        (operation) =>
          reconcileOne(operation, leaseToken).pipe(
            Effect.timeout(Duration.seconds(60)),
            Effect.catchCause((cause) =>
              Cause.hasInterrupts(cause)
                ? Effect.interrupt
                : Effect.gen(function* () {
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
