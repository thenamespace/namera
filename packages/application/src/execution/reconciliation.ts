import { DateTime, Duration, Effect, Metric, Option, Predicate, Result } from "effect";

import { CryptoService } from "@namera-ai/crypto";
import { Repository } from "@namera-ai/database";
import { Evm, isReceiptForEvmExecution } from "@namera-ai/evm";
import type { EvmSessionKey, ExecutionSubmission } from "@namera-ai/protocol/model";
import { executionReconciliations, executionResults } from "@namera-ai/telemetry";

import { makeExecutionLifecycle } from "#/execution/lifecycle";

const reconciliationPolicy = {
  batchSize: 20,
  concurrency: 5,
  leaseDuration: Duration.minutes(2),
  retryDelay: Duration.seconds(15),
  broadcastLifetime: Duration.hours(24),
  unresolvedRetryDelay: Duration.minutes(5),
} as const;

export const makeExecutionReconciliation = Effect.gen(function* () {
  const crypto = yield* CryptoService;
  const evm = yield* Evm;
  const repository = yield* Repository;
  const lifecycle = yield* makeExecutionLifecycle;

  const retry = Effect.fn("application.execution.reconciliation.retry")(function* (
    submission: ExecutionSubmission,
    leaseToken: string,
    reason: string,
  ) {
    const now = yield* DateTime.now;
    const unresolved = DateTime.isGreaterThanOrEqualTo(
      now,
      DateTime.addDuration(submission.createdAt, reconciliationPolicy.broadcastLifetime),
    );
    yield* repository.core.executionSubmission.releaseLease({
      id: submission.id,
      organizationId: submission.organizationId,
      leaseToken,
      nextReconcileAt: DateTime.addDuration(
        now,
        unresolved ? reconciliationPolicy.unresolvedRetryDelay : reconciliationPolicy.retryDelay,
      ),
    });
    yield* Metric.update(
      Metric.withAttributes(executionReconciliations, {
        namespace: submission.namespace,
        result: unresolved ? "unresolved" : "retry",
      }),
      1,
    );
    yield* (
      unresolved
        ? Effect.logWarning("execution.reconciliation.unresolved")
        : Effect.logDebug("execution.reconciliation.deferred")
    ).pipe(Effect.annotateLogs({ submission_id: submission.id, reason }));
  });

  const reconcileOne = Effect.fn("application.execution.reconciliation.process")(function* (
    submission: ExecutionSubmission,
    leaseToken: string,
  ) {
    const grantView = yield* repository.core.sessionKeyGrant.findByIdWithSessionKey(
      submission.sessionKeyGrantId,
      submission.organizationId,
    );
    if (grantView === undefined || grantView.sessionKey.namespace !== "eip155") {
      yield* retry(submission, leaseToken, "grant_unavailable");
      return;
    }
    const sessionKey: EvmSessionKey = grantView.sessionKey;
    const wallet = yield* repository.core.wallet.findById(
      sessionKey.walletId,
      submission.organizationId,
    );
    if (wallet === undefined || submission.data.signedExecution === null) {
      yield* lifecycle.release({
        organizationId: submission.organizationId,
        actorId: submission.actorId,
        submissionId: submission.id,
        sessionKey,
        stage: "submit",
        leaseToken,
      });
      return;
    }

    const signed = submission.data.signedExecution;
    const broadcastExpired = DateTime.isGreaterThanOrEqualTo(
      yield* DateTime.now,
      DateTime.addDuration(submission.createdAt, reconciliationPolicy.broadcastLifetime),
    );
    if (submission.status === "prepared" && !broadcastExpired) {
      // Persist before RPC: a crash or lost response must survive lease takeover.
      const attempt = yield* repository.core.executionSubmission.recordBroadcastAttempt({
        id: submission.id,
        organizationId: submission.organizationId,
        leaseToken,
        now: yield* DateTime.now,
      });
      if (attempt === undefined) return;
      const submitted = yield* evm.execution.submit({ signed }).pipe(Effect.result);
      if (Result.isSuccess(submitted)) {
        yield* lifecycle.markSubmitted({
          submissionId: submission.id,
          organizationId: submission.organizationId,
          actorId: submission.actorId,
          grant: grantView.grant,
          signedExecution: signed,
          leaseToken,
        });
        return;
      }

      const definitivelyRejected =
        submission.data.broadcastAttempted !== true &&
        Predicate.isTagged(submitted.failure, "EvmExecutionError") &&
        submitted.failure.code === "SUBMISSION_REJECTED";

      const status = yield* evm.execution
        .getStatus({ chainId: signed.chainId, userOperationHash: signed.userOperationHash })
        .pipe(Effect.result);
      if (Result.isFailure(status)) {
        yield* retry(submission, leaseToken, "submit_status_unavailable");
        return;
      }
      if (
        status.success.status === "submitted" ||
        status.success.status === "included" ||
        status.success.status === "reverted" ||
        status.success.status === "failed"
      ) {
        // Included failures also need receipt recovery for actual sponsored gas.
        yield* lifecycle.markSubmitted({
          submissionId: submission.id,
          organizationId: submission.organizationId,
          actorId: submission.actorId,
          grant: grantView.grant,
          signedExecution: signed,
          leaseToken,
        });
        return;
      }
      if (status.success.status === "rejected") {
        yield* lifecycle.release({
          organizationId: submission.organizationId,
          actorId: submission.actorId,
          submissionId: submission.id,
          sessionKey,
          stage: "submit",
          leaseToken,
        });
        return;
      }
      if (
        definitivelyRejected &&
        (status.success.status === "not_found" || status.success.status === "not_submitted")
      ) {
        yield* lifecycle.release({
          organizationId: submission.organizationId,
          actorId: submission.actorId,
          submissionId: submission.id,
          sessionKey,
          stage: "submit",
          leaseToken,
        });
        return;
      }
      yield* retry(submission, leaseToken, "submission_not_observed");
      return;
    }

    const receipt = yield* evm.execution
      .getReceipt({ chainId: signed.chainId, userOperationHash: signed.userOperationHash })
      .pipe(Effect.result);
    if (Result.isSuccess(receipt) && Option.isSome(receipt.success)) {
      if (!isReceiptForEvmExecution(signed, receipt.success.value)) {
        yield* retry(submission, leaseToken, "receipt_mismatch");
        return;
      }
      // An old ambiguous broadcast can become visible after we stop sending it.
      // Preserve the normal submitted transition before settling on the next pass.
      if (submission.status === "prepared") {
        yield* lifecycle.markSubmitted({
          submissionId: submission.id,
          organizationId: submission.organizationId,
          actorId: submission.actorId,
          grant: grantView.grant,
          signedExecution: signed,
          leaseToken,
        });
        return;
      }
      if (!receipt.success.value.success) {
        yield* lifecycle.release({
          organizationId: submission.organizationId,
          actorId: submission.actorId,
          submissionId: submission.id,
          sessionKey,
          stage: "receipt",
          receipt: receipt.success.value,
          leaseToken,
        });
        yield* Metric.update(
          Metric.withAttributes(executionReconciliations, {
            namespace: submission.namespace,
            result: "failed",
          }),
          1,
        );
        return;
      }

      const execution = yield* lifecycle.settle({
        organizationId: submission.organizationId,
        actorId: submission.actorId,
        submissionId: submission.id,
        grant: grantView.grant,
        sessionKey,
        wallet,
        receipt: receipt.success.value,
        leaseToken,
      });
      if (execution !== undefined) {
        yield* Metric.update(
          Metric.withAttributes(executionReconciliations, {
            namespace: submission.namespace,
            result: "confirmed",
          }),
          1,
        );
        yield* Metric.update(
          Metric.withAttributes(executionResults, {
            namespace: submission.namespace,
            result: "confirmed",
          }),
          1,
        );
      }
      return;
    }

    const status = yield* evm.execution
      .getStatus({ chainId: signed.chainId, userOperationHash: signed.userOperationHash })
      .pipe(Effect.result);
    if (Result.isSuccess(status) && status.success.status === "rejected") {
      yield* lifecycle.release({
        organizationId: submission.organizationId,
        actorId: submission.actorId,
        submissionId: submission.id,
        sessionKey,
        stage: "receipt",
        leaseToken,
      });
      yield* Metric.update(
        Metric.withAttributes(executionReconciliations, {
          namespace: submission.namespace,
          result: "failed",
        }),
        1,
      );
      return;
    }
    yield* retry(
      submission,
      leaseToken,
      Result.isFailure(status) ? "status_unavailable" : status.success.status,
    );
  });

  const reconcile = Effect.fn("application.execution.reconcile")(
    function* () {
      const now = yield* DateTime.now;
      const leaseToken = yield* crypto.randomToken(24);
      const submissions = yield* repository.core.executionSubmission.claimForReconciliation({
        now,
        leaseToken,
        leaseExpiresAt: DateTime.addDuration(now, reconciliationPolicy.leaseDuration),
        limit: reconciliationPolicy.batchSize,
      });
      if (submissions.length === 0) return 0;

      yield* Effect.forEach(
        submissions,
        (submission) =>
          reconcileOne(submission, leaseToken).pipe(
            Effect.catch(() =>
              // Provider/database causes can contain signed envelopes or credentials.
              Effect.logError("execution.reconciliation.failed").pipe(
                Effect.annotateLogs({ submission_id: submission.id }),
                Effect.andThen(retry(submission, leaseToken, "unexpected_error")),
                Effect.catch(() => Effect.void),
              ),
            ),
          ),
        { concurrency: reconciliationPolicy.concurrency, discard: true },
      );
      return submissions.length;
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  return { reconcile } as const;
});
