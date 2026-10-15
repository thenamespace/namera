import { DateTime, Duration, Effect } from "effect";

import { Repository, TransactionService, type WalletView } from "@namera-ai/database";
import type {
  ActorId,
  EvmExecutionReceipt,
  ExecutionSubmissionId,
  OrganizationId,
  SuccessfulEvmExecutionReceipt,
} from "@namera-ai/protocol";
import type {
  EvmSessionKey,
  ExecutionSubmission,
  SessionKeyGrant,
} from "@namera-ai/protocol/model";

import { Audit } from "#/audit/layer";
import { makeBillingMetering } from "#/billing/index";
import { makeCreateNotification } from "#/notification/create";

export const makeExecutionLifecycle = Effect.gen(function* () {
  const audit = yield* Audit;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const createNotification = yield* makeCreateNotification;
  const billing = yield* makeBillingMetering;

  const releaseExecutionBilling = Effect.fnUntraced(function* (
    organizationId: OrganizationId,
    submission: Extract<ExecutionSubmission, { namespace: "eip155" }>,
    receipt?: EvmExecutionReceipt,
  ) {
    const reservations = yield* repository.billing.usageReservation.listBySource(
      organizationId,
      "execution-submission",
      submission.id,
    );
    for (const reservation of reservations) {
      if (reservation.meterKey !== "gas-sponsorship" || receipt === undefined) {
        yield* billing.release({ organizationId, reservationId: reservation.id });
        continue;
      }
      const signed = submission.data.signedExecution;
      if (signed === null) {
        yield* billing.release({ organizationId, reservationId: reservation.id });
        continue;
      }
      // Included failures also incur a provider charge; keep the hold for reconciliation.
      yield* repository.billing.usageReservation.deferExpiry(
        organizationId,
        reservation.id,
        yield* DateTime.now,
      );
    }
  });

  const settleExecutionBilling = Effect.fnUntraced(function* (
    organizationId: OrganizationId,
    submission: Extract<ExecutionSubmission, { namespace: "eip155" }>,
    receipt: EvmExecutionReceipt,
  ) {
    const reservations = yield* repository.billing.usageReservation.listBySource(
      organizationId,
      "execution-submission",
      submission.id,
    );
    for (const reservation of reservations) {
      const signed = submission.data.signedExecution;
      if (reservation.meterKey === "gas-sponsorship" && signed === null) {
        return yield* Effect.die("Sponsored execution billing envelope is missing");
      }
      if (reservation.meterKey === "gas-sponsorship") {
        yield* repository.billing.usageReservation.deferExpiry(
          organizationId,
          reservation.id,
          yield* DateTime.now,
        );
        continue;
      }
      yield* billing.settle({
        organizationId,
        reservationId: reservation.id,
        amount: 1n,
        data: {
          version: 1,
          namespace: "eip155",
          chainId: receipt.chainId,
          transactionHash: receipt.transactionHash,
        },
      });
    }
  });

  // Submission locks serialize finalization with cancellation and reconciliation.
  const release = Effect.fn("application.execution.release")(function* (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly submissionId: ExecutionSubmissionId;
    readonly sessionKey: EvmSessionKey;
    readonly stage: "sign" | "submit" | "receipt" | "cancel";
    readonly receipt?: EvmExecutionReceipt;
    readonly leaseToken?: string;
  }) {
    return yield* transaction.run(
      Effect.gen(function* () {
        const submission = yield* repository.core.executionSubmission.findByIdForUpdate(
          input.submissionId,
          input.organizationId,
        );
        if (input.stage === "cancel" && submission?.status === "cancelled")
          return submission.actorId === input.actorId;
        if (
          submission === undefined ||
          submission.status === "cancelled" ||
          submission.status === "confirmed" ||
          submission.status === "failed" ||
          (input.leaseToken !== undefined && submission.leaseToken !== input.leaseToken)
        ) {
          return false;
        }
        // Cancellation wins only before signature acceptance and outside an active
        // signing/expiry lease. This transition and all releases commit together.
        if (input.stage === "cancel") {
          const cancelled = yield* repository.core.executionSubmission.cancelUnsigned({
            id: submission.id,
            organizationId: input.organizationId,
            actorId: input.actorId,
            now: yield* DateTime.now,
          });
          if (!cancelled) return false;
        }
        const now = yield* DateTime.now;
        yield* releaseExecutionBilling(input.organizationId, submission, input.receipt);
        if (input.stage === "cancel") {
          yield* audit.organization({
            organizationId: input.organizationId,
            actorId: input.actorId,
            event: "execution.cancelled",
            resourceType: "execution-submission",
            resourceId: submission.id,
            data: {
              version: 1,
              namespace: "eip155",
              chainId: submission.data.chainId,
              sessionKeyGrantId: submission.sessionKeyGrantId,
            },
          });
          return true;
        }
        const failed = yield* repository.core.executionSubmission.markFailed({
          id: input.submissionId,
          organizationId: input.organizationId,
          failedAt: now,
          ...(input.leaseToken === undefined ? {} : { leaseToken: input.leaseToken }),
        });
        if (failed === undefined) return false;
        yield* audit.organization({
          organizationId: input.organizationId,
          actorId: input.actorId,
          event: "execution.failed",
          resourceType: "execution-submission",
          resourceId: input.submissionId,
          data: {
            version: 1,
            namespace: "eip155",
            chainId: submission.data.chainId,
            stage: input.stage,
          },
        });
        return true;
      }),
    );
  });

  const markSubmitted = Effect.fn("application.execution.markSubmitted")(function* (input: {
    readonly submissionId: ExecutionSubmissionId;
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly grant: SessionKeyGrant;
    readonly signedExecution: NonNullable<
      Extract<ExecutionSubmission, { namespace: "eip155" }>["data"]["signedExecution"]
    >;
    readonly leaseToken?: string;
    readonly reconcileAfterSeconds?: number;
  }) {
    return yield* transaction.run(
      Effect.gen(function* () {
        const now = yield* DateTime.now;
        const updated = yield* repository.core.executionSubmission.markSubmitted({
          id: input.submissionId,
          organizationId: input.organizationId,
          submittedAt: now,
          nextReconcileAt: DateTime.addDuration(
            now,
            Duration.seconds(input.reconcileAfterSeconds ?? 15),
          ),
          ...(input.leaseToken === undefined ? {} : { leaseToken: input.leaseToken }),
        });
        if (updated === undefined) return false;
        yield* audit.organization({
          organizationId: input.organizationId,
          actorId: input.actorId,
          event: "execution.submitted",
          resourceType: "execution-submission",
          resourceId: input.submissionId,
          data: {
            version: 1,
            namespace: "eip155",
            chainId: input.signedExecution.chainId,
            sessionKeyGrantId: input.grant.id,
            userOperationHash: input.signedExecution.userOperationHash,
          },
        });
        return true;
      }),
    );
  });

  // A confirmed execution, its audit row, billing usage,
  // and notification records share this transaction. Partial confirmation is
  // therefore never visible to subsequent authorization decisions.
  const settle = Effect.fn("application.execution.settle")(function* (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly submissionId: ExecutionSubmissionId;
    readonly grant: SessionKeyGrant;
    readonly sessionKey: EvmSessionKey;
    readonly wallet: WalletView;
    readonly receipt: SuccessfulEvmExecutionReceipt;
    readonly leaseToken?: string;
  }) {
    return yield* transaction.run(
      Effect.gen(function* () {
        const submission = yield* repository.core.executionSubmission.findByIdForUpdate(
          input.submissionId,
          input.organizationId,
        );
        if (submission === undefined) return undefined;
        if (submission.status === "confirmed") {
          return yield* repository.core.execution.findBySubmissionId(
            submission.id,
            input.organizationId,
          );
        }
        if (
          submission.status === "failed" ||
          submission.status === "cancelled" ||
          (input.leaseToken !== undefined && submission.leaseToken !== input.leaseToken)
        ) {
          return undefined;
        }

        const now = yield* DateTime.now;
        yield* settleExecutionBilling(input.organizationId, submission, input.receipt);
        const created = yield* repository.core.execution.insert({
          executionSubmissionId: input.submissionId,
          organizationId: input.organizationId,
          sessionKeyGrantId: input.grant.id,
          namespace: "eip155",
          data: {
            version: 1,
            chainId: submission.data.chainId,
            calls: submission.data.calls,
            userOperationHash: input.receipt.userOperationHash,
            transactionHash: input.receipt.transactionHash,
            receipt: input.receipt,
          },
        });
        const confirmed = yield* repository.core.executionSubmission.markConfirmed({
          id: input.submissionId,
          organizationId: input.organizationId,
          confirmedAt: now,
          ...(input.leaseToken === undefined ? {} : { leaseToken: input.leaseToken }),
        });
        if (confirmed === undefined) return yield* Effect.die("Execution lease was lost");
        const event = yield* audit.organization({
          organizationId: input.organizationId,
          actorId: input.actorId,
          event: "execution.confirmed",
          resourceType: "execution",
          resourceId: created.id,
          data: {
            version: 1,
            namespace: "eip155",
            chainId: submission.data.chainId,
            submissionId: input.submissionId,
            transactionHash: input.receipt.transactionHash,
            userOperationHash: input.receipt.userOperationHash,
          },
        });
        const members = yield* repository.auth.member.findOrganizationMembersForOrg(
          input.organizationId,
        );
        yield* createNotification({
          organizationId: input.organizationId,
          actorId: input.actorId,
          type: "execution.confirmed",
          resourceType: "execution",
          resourceId: created.id,
          data: {
            version: 1,
            namespace: "eip155",
            chainId: submission.data.chainId,
            transactionHash: input.receipt.transactionHash,
          },
          idempotencyKey: `notification:execution.confirmed:${created.id}`,
          correlationId: event.correlationId,
          expiresAt: null,
          recipients: members
            .filter(({ organizationRole }) =>
              organizationRole.permissions.includes("execution:read"),
            )
            .map(({ user }) => ({
              userId: user.id,
            })),
        });
        return created;
      }),
    );
  });

  return { markSubmitted, release, settle } as const;
});
