import { DateTime, Duration, Effect } from "effect";

import { Repository, TransactionService, type WalletView } from "@namera-ai/database";
import { formatEmailTransactionHash, getEmailChainIconUrl } from "@namera-ai/emails";
import { Evm, getChainDataByCaip2 } from "@namera-ai/evm";
import type {
  ActorId,
  ExecutionSubmissionId,
  OrganizationId,
  SuccessfulEvmExecutionReceipt,
} from "@namera-ai/protocol";
import type {
  EvmSessionKey,
  ExecutionSubmission,
  SessionKeyGrant,
  SessionKeyPolicyState,
} from "@namera-ai/protocol/model";

import { Audit } from "#/audit/layer";
import { makeCreateNotification } from "#/notification/create";
import { notificationPolicy } from "#/notification/data";

export const makeExecutionLifecycle = Effect.gen(function* () {
  const audit = yield* Audit;
  const evm = yield* Evm;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const createNotification = yield* makeCreateNotification;

  const applyStateChanges = Effect.fnUntraced(function* (
    organizationId: OrganizationId,
    states: ReadonlyArray<SessionKeyPolicyState>,
    changes: ReadonlyArray<{
      readonly policyId: SessionKeyPolicyState["policyId"];
      readonly stateKey: string;
      readonly stateVersion: number;
      readonly data: SessionKeyPolicyState["data"];
    }>,
  ) {
    for (const change of changes) {
      const state = states.find(
        (item) => item.policyId === change.policyId && item.stateKey === change.stateKey,
      );
      if (state === undefined) return yield* Effect.die("Policy state is missing");
      const updated = yield* repository.core.sessionKeyPolicyState.update({
        id: state.id,
        organizationId,
        expectedRevision: state.revision,
        stateVersion: change.stateVersion,
        data: change.data,
      });
      if (updated === undefined) return yield* Effect.die("Concurrent policy-state update failed");
    }
  });

  const loadLockedStates = Effect.fnUntraced(function* (
    organizationId: OrganizationId,
    sessionKey: EvmSessionKey,
    chainId: string,
  ) {
    const statefulPolicies = sessionKey.policies.filter(
      (policy) => policy.type === "evm.native-spend-limit",
    );
    yield* repository.core.sessionKeyPolicyState.insertManyIfMissing(
      statefulPolicies.map((policy) => ({
        organizationId,
        sessionKeyId: sessionKey.id,
        policyId: policy.id,
        stateKey: chainId,
        stateVersion: 1,
        data: { version: 1, spent: "0", reserved: "0" },
      })),
    );
    const states = yield* Effect.forEach(sessionKey.policies, (policy) =>
      repository.core.sessionKeyPolicyState.findForPolicyForUpdate(
        organizationId,
        sessionKey.id,
        policy.id,
      ),
    );
    return states.flat();
  });

  const release = Effect.fn("application.execution.release")(function* (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly submissionId: ExecutionSubmissionId;
    readonly sessionKey: EvmSessionKey;
    readonly stage: "sign" | "submit" | "receipt";
    readonly leaseToken?: string;
  }) {
    return yield* transaction.run(
      Effect.gen(function* () {
        const submission = yield* repository.core.executionSubmission.findByIdForUpdate(
          input.submissionId,
          input.organizationId,
        );
        if (
          submission === undefined ||
          submission.status === "confirmed" ||
          submission.status === "failed" ||
          (input.leaseToken !== undefined && submission.leaseToken !== input.leaseToken)
        ) {
          return false;
        }
        const states = yield* loadLockedStates(
          input.organizationId,
          input.sessionKey,
          submission.data.chainId,
        );
        const reservations = yield* repository.core.sessionKeyPolicyReservation.findForSubmission(
          input.organizationId,
          input.submissionId,
        );
        const changes = yield* evm.policy.release({
          policies: input.sessionKey.policies,
          states,
          reservations,
        });
        yield* applyStateChanges(input.organizationId, states, changes);
        const now = yield* DateTime.now;
        yield* repository.core.sessionKeyPolicyReservation.markReleased(
          input.organizationId,
          input.submissionId,
          now,
        );
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
        yield* repository.core.sessionKeyPolicyReservation.markSubmitted(
          input.organizationId,
          input.submissionId,
          now,
        );
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
          (input.leaseToken !== undefined && submission.leaseToken !== input.leaseToken)
        ) {
          return undefined;
        }

        const states = yield* loadLockedStates(
          input.organizationId,
          input.sessionKey,
          submission.data.chainId,
        );
        const reservations = yield* repository.core.sessionKeyPolicyReservation.findForSubmission(
          input.organizationId,
          input.submissionId,
        );
        const changes = yield* evm.policy.settle({
          policies: input.sessionKey.policies,
          states,
          reservations,
          result: input.receipt,
        });
        yield* applyStateChanges(input.organizationId, states, changes);
        const now = yield* DateTime.now;
        yield* repository.core.sessionKeyPolicyReservation.markSettled(
          input.organizationId,
          input.submissionId,
          now,
        );
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
        const organization = yield* repository.auth.organization.findById(input.organizationId);
        if (organization === undefined)
          return yield* Effect.die("Execution organization is missing");
        const chain = getChainDataByCaip2(submission.data.chainId);
        if (chain === undefined) return yield* Effect.die("Execution chain is missing");
        const blockExplorerUrl = chain.chain.blockExplorers?.default.url;
        if (blockExplorerUrl === undefined)
          return yield* Effect.die("Execution chain block explorer is missing");
        const transactionUrl = `${blockExplorerUrl.replace(/\/$/, "")}/tx/${input.receipt.transactionHash}`;
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
              email: {
                type: "execution-confirmed" as const,
                to: user.email,
                expiresAt: DateTime.addDuration(
                  now,
                  notificationPolicy["execution.confirmed"].emailTimeToLive,
                ),
                variables: {
                  organizationName: organization.metadata.name,
                  walletName: input.wallet.wallet.metadata.name,
                  chainId: submission.data.chainId,
                  chainName: chain.chain.name,
                  chainIconUrl: getEmailChainIconUrl(chain.name),
                  transactionHashDisplay: formatEmailTransactionHash(input.receipt.transactionHash),
                  transactionUrl,
                },
              },
            })),
        });
        return created;
      }),
    );
  });

  return { loadLockedStates, applyStateChanges, markSubmitted, release, settle } as const;
});
