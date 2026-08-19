import {
  Data,
  DateTime,
  Duration,
  Effect,
  Metric,
  Option,
  Predicate,
  Result,
  Schema,
} from "effect";

import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository, TransactionService } from "@namera-ai/database";
import { Evm } from "@namera-ai/evm";
import {
  ExecutionError,
  type BillingError,
  type EvmExecutionReceipt,
  type EvmPolicyDeniedDecision,
  type ExecutionSubmissionId,
  type OrganizationId,
  type SuccessfulEvmExecutionReceipt,
} from "@namera-ai/protocol";
import { ExecuteRequest } from "@namera-ai/protocol/dto";
import type { ExecuteResponse, GrantedActorData } from "@namera-ai/protocol/dto";
import type { EvmSessionKey, SessionKeyGrant } from "@namera-ai/protocol/model";
import {
  executionDuration,
  executionPolicyDecisions,
  executionResults,
} from "@namera-ai/telemetry";

import { enforceExecutionLimit, lockOrganizationBilling } from "#/billing/index";
import { makeExecutionLifecycle } from "#/execution/lifecycle";
import { makeExecutionReadApplication, type ExecutionReadApplication } from "#/execution/read";
import { makeExecutionReconciliation } from "#/execution/reconciliation";
import { makeLoadEvmAccount } from "#/wallet/account";

class ExistingSubmission extends Data.TaggedError("ExistingSubmission")<{
  readonly id: ExecutionSubmissionId;
}> {}

type GrantedSessionKey = {
  readonly grant: SessionKeyGrant;
  readonly sessionKey: EvmSessionKey;
};

const encodeRequest = Schema.encodeSync(ExecuteRequest);

export interface ExecutionApplication extends ExecutionReadApplication {
  readonly execute: (input: {
    readonly actor: GrantedActorData;
    readonly idempotencyKey: string;
    readonly request: ExecuteRequest;
  }) => Effect.Effect<ExecuteResponse, BillingError | ExecutionError>;
  readonly reconcile: () => Effect.Effect<number>;
}

export const makeExecutionApplication = Effect.gen(function* () {
  const crypto = yield* CryptoService;
  const evm = yield* Evm;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const loadEvmAccount = yield* makeLoadEvmAccount;
  const lifecycle = yield* makeExecutionLifecycle;
  const reconciliation = yield* makeExecutionReconciliation;
  const read = yield* makeExecutionReadApplication;

  const responseForExisting = Effect.fnUntraced(function* (
    organizationId: OrganizationId,
    requestHash: string,
    submissionId: ExecutionSubmissionId,
  ) {
    const submission = yield* repository.core.executionSubmission.findById(
      submissionId,
      organizationId,
    );
    if (submission === undefined || submission.requestHash !== requestHash) {
      return yield* new ExecutionError({ code: "IDEMPOTENCY_CONFLICT" });
    }
    if (submission.status === "failed") {
      return yield* new ExecutionError({ code: "EXECUTION_FAILED" });
    }
    if (submission.status === "confirmed") {
      const execution = yield* repository.core.execution.findBySubmissionId(
        submission.id,
        organizationId,
      );
      if (execution === undefined || execution.namespace !== "eip155") {
        return yield* new ExecutionError({ code: "EXECUTION_UNAVAILABLE" });
      }
      return {
        namespace: "eip155" as const,
        status: "confirmed" as const,
        submissionId: submission.id,
        executionId: execution.id,
        receipt: execution.data.receipt,
      };
    }
    if (submission.data.signedExecution === null) {
      return yield* new ExecutionError({ code: "EXECUTION_UNAVAILABLE" });
    }
    return {
      namespace: "eip155" as const,
      status: "submitted" as const,
      submissionId: submission.id,
      userOperationHash: submission.data.signedExecution.userOperationHash,
    };
  });

  const execute = Effect.fn("application.execution.execute")(
    function* (input: {
      readonly actor: GrantedActorData;
      readonly idempotencyKey: string;
      readonly request: ExecuteRequest;
    }) {
      const requestHash = yield* crypto.hash({
        purpose: cryptoPurpose.executionRequest,
        value: JSON.stringify(encodeRequest(input.request)),
      });
      const prior = yield* repository.core.executionSubmission.findByActorAndIdempotencyKey(
        input.actor.organizationId,
        input.actor.actorId,
        input.idempotencyKey,
      );
      if (prior !== undefined) {
        return yield* responseForExisting(input.actor.organizationId, requestHash, prior.id);
      }

      const wallet = yield* repository.core.wallet.findById(
        input.request.walletId,
        input.actor.organizationId,
      );
      if (wallet === undefined || wallet.wallet.namespace !== input.request.namespace) {
        return yield* new ExecutionError({ code: "EXECUTION_UNAVAILABLE" });
      }
      const account = yield* loadEvmAccount(wallet).pipe(
        Effect.mapError(() => new ExecutionError({ code: "EXECUTION_UNAVAILABLE" })),
      );
      const prepared = yield* evm.execution
        .prepare({ chainId: input.request.chainId, account, calls: input.request.calls })
        .pipe(Effect.mapError(() => new ExecutionError({ code: "EXECUTION_FAILED" })));

      const candidates = input.actor.grants.filter(
        (item): item is GrantedSessionKey =>
          item.sessionKey.namespace === "eip155" &&
          item.sessionKey.walletId === input.request.walletId &&
          item.sessionKey.status === "active",
      );
      if (candidates.length === 0) {
        return yield* new ExecutionError({ code: "NO_AUTHORIZED_SESSION_KEY" });
      }

      let selected: GrantedSessionKey | undefined;
      let submissionId: ExecutionSubmissionId | undefined;
      let lastPolicyDenial: EvmPolicyDeniedDecision | undefined;
      // One session key must authorize the complete call batch. Combining
      // permissions from multiple grants would create authority that no user
      // explicitly granted and would make stateful reservations ambiguous.
      for (const candidate of candidates) {
        const decision = yield* evm.policy.evaluate({
          policies: candidate.sessionKey.policies,
          context: prepared.context,
        });
        yield* Metric.update(
          Metric.withAttributes(executionPolicyDecisions, {
            namespace: "eip155",
            result: decision.allowed ? "allowed" : "denied",
          }),
          1,
        );
        if (!decision.allowed) {
          lastPolicyDenial = decision;
          continue;
        }

        const reserved = yield* transaction
          .run(
            Effect.gen(function* () {
              yield* lockOrganizationBilling(repository, input.actor.organizationId);
              yield* enforceExecutionLimit(repository, input.actor.organizationId);
              const states = yield* lifecycle.initializeAndLockStates(
                input.actor.organizationId,
                candidate.sessionKey,
                prepared.context,
              );
              const plan = yield* evm.policy.reserve({
                policies: candidate.sessionKey.policies,
                context: prepared.context,
                states,
              });
              if (!plan.decision.allowed) return { decision: plan.decision } as const;
              const inserted = yield* repository.core.executionSubmission.insert({
                organizationId: input.actor.organizationId,
                actorId: input.actor.actorId,
                sessionKeyGrantId: candidate.grant.id,
                idempotencyKey: input.idempotencyKey,
                requestHash,
                policyHash: candidate.sessionKey.policyHash,
                namespace: "eip155",
                data: {
                  version: 1,
                  chainId: input.request.chainId,
                  calls: input.request.calls,
                  signedExecution: null,
                },
              });
              if (!inserted.inserted)
                return yield* new ExistingSubmission({ id: inserted.submission.id });
              yield* lifecycle.applyStateChanges(
                input.actor.organizationId,
                states,
                plan.stateChanges,
              );
              const reservationNow = yield* DateTime.now;
              yield* repository.core.sessionKeyPolicyReservation.insertMany(
                plan.reservations.map((reservation) => ({
                  organizationId: input.actor.organizationId,
                  sessionKeyId: candidate.sessionKey.id,
                  policyId: reservation.policyId,
                  executionSubmissionId: inserted.submission.id,
                  signatureOperationId: null,
                  stateKey: reservation.stateKey,
                  reservationVersion: reservation.reservationVersion,
                  data: reservation.data,
                  expiresAt: DateTime.addDuration(reservationNow, Duration.minutes(10)),
                })),
              );
              return { decision: plan.decision, submissionId: inserted.submission.id } as const;
            }),
          )
          .pipe(
            Effect.catchTag("ExistingSubmission", (existing) =>
              responseForExisting(input.actor.organizationId, requestHash, existing.id).pipe(
                Effect.map((response) => ({ existing: response }) as const),
              ),
            ),
          );
        if ("existing" in reserved) return reserved.existing;
        if (!reserved.decision.allowed) {
          lastPolicyDenial = reserved.decision;
          continue;
        }
        selected = candidate;
        submissionId = reserved.submissionId;
        break;
      }

      if (selected === undefined || submissionId === undefined) {
        return yield* new ExecutionError({
          code: "POLICY_DENIED",
          ...(lastPolicyDenial === undefined
            ? {}
            : {
                policyId: lastPolicyDenial.policyId,
                policyCode: lastPolicyDenial.code,
              }),
        });
      }

      const signed = yield* evm.execution.sign({ account, prepared }).pipe(
        Effect.tapError(() =>
          lifecycle
            .release({
              organizationId: input.actor.organizationId,
              actorId: input.actor.actorId,
              submissionId,
              sessionKey: selected.sessionKey,
              stage: "sign",
            })
            .pipe(Effect.orDie),
        ),
        Effect.mapError(() => new ExecutionError({ code: "EXECUTION_FAILED" })),
      );
      yield* repository.core.executionSubmission.markPrepared({
        id: submissionId,
        organizationId: input.actor.organizationId,
        data: {
          version: 1,
          chainId: input.request.chainId,
          calls: input.request.calls,
          signedExecution: signed,
        },
        nextReconcileAt: DateTime.addDuration(yield* DateTime.now, Duration.seconds(45)),
      });
      const submitted = yield* evm.execution.submit({ signed }).pipe(Effect.result);
      if (
        Result.isFailure(submitted) &&
        (!Predicate.isTagged(submitted.failure, "EvmExecutionError") ||
          submitted.failure.code !== "SUBMISSION_UNKNOWN")
      ) {
        yield* lifecycle.release({
          organizationId: input.actor.organizationId,
          actorId: input.actor.actorId,
          submissionId,
          sessionKey: selected.sessionKey,
          stage: "submit",
        });
        return yield* new ExecutionError({ code: "EXECUTION_FAILED" });
      }
      yield* lifecycle.markSubmitted({
        submissionId,
        organizationId: input.actor.organizationId,
        actorId: input.actor.actorId,
        grant: selected.grant,
        signedExecution: signed,
        reconcileAfterSeconds: 45,
      });
      const receiptOption = yield* evm.execution
        .waitForReceipt({
          chainId: input.request.chainId,
          userOperationHash: signed.userOperationHash,
        })
        .pipe(Effect.orElseSucceed(() => Option.none<EvmExecutionReceipt>()));
      if (Option.isNone(receiptOption)) {
        yield* Metric.update(
          Metric.withAttributes(executionResults, { namespace: "eip155", result: "submitted" }),
          1,
        );
        return {
          namespace: "eip155" as const,
          status: "submitted" as const,
          submissionId,
          userOperationHash: signed.userOperationHash,
        };
      }
      const receipt = receiptOption.value;
      if (!receipt.success) {
        yield* lifecycle.release({
          organizationId: input.actor.organizationId,
          actorId: input.actor.actorId,
          submissionId,
          sessionKey: selected.sessionKey,
          stage: "receipt",
        });
        return yield* new ExecutionError({ code: "EXECUTION_FAILED" });
      }

      const execution = yield* lifecycle.settle({
        organizationId: input.actor.organizationId,
        actorId: input.actor.actorId,
        submissionId,
        grant: selected.grant,
        sessionKey: selected.sessionKey,
        wallet,
        receipt,
      });
      if (execution === undefined) {
        return yield* new ExecutionError({ code: "EXECUTION_UNAVAILABLE" });
      }

      yield* Metric.update(
        Metric.withAttributes(executionResults, { namespace: "eip155", result: "confirmed" }),
        1,
      );
      return {
        namespace: "eip155" as const,
        status: "confirmed" as const,
        submissionId,
        executionId: execution.id,
        receipt: receipt as SuccessfulEvmExecutionReceipt,
      };
    },
    Effect.trackDuration(executionDuration),
    Effect.catchTag("DatabaseError", Effect.die),
    Effect.catchTag("EvmPolicyError", () => new ExecutionError({ code: "EXECUTION_UNAVAILABLE" })),
  );

  return { execute, reconcile: reconciliation.reconcile, ...read } satisfies ExecutionApplication;
});
