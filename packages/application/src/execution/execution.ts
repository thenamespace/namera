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
import { Repository, TransactionService, type WalletView } from "@namera-ai/database";
import { Evm, createWalletKeyWebAuthnAccount } from "@namera-ai/evm";
import {
  ExecutionError,
  type ActorId,
  type BillingError,
  type EvmExecutionReceipt,
  type ExecutionSubmissionId,
  type OrganizationId,
  type SuccessfulEvmExecutionReceipt,
} from "@namera-ai/protocol";
import { ExecuteRequest } from "@namera-ai/protocol/dto";
import type { ApiKeyActorData, ExecuteResponse } from "@namera-ai/protocol/dto";
import {
  GcpWalletKeyData,
  LocalWalletKeyData,
  type EvmSessionKey,
  type SessionKeyGrant,
  type SessionKeyPolicyState,
} from "@namera-ai/protocol/model";
import {
  executionDuration,
  executionPolicyDecisions,
  executionResults,
} from "@namera-ai/telemetry";
import { WalletKeys } from "@namera-ai/wallet-keys";

import { Audit } from "#/audit/layer";
import { AuthConfig } from "#/auth/config";
import { enforceExecutionLimit, lockOrganizationBilling } from "#/billing/index";
import { makeCreateNotification } from "#/notification/create";
import { notificationPolicy } from "#/notification/data";

class ExistingSubmission extends Data.TaggedError("ExistingSubmission")<{
  readonly id: ExecutionSubmissionId;
}> {}

type GrantedSessionKey = {
  readonly grant: SessionKeyGrant;
  readonly sessionKey: EvmSessionKey;
};

const encodeRequest = Schema.encodeSync(ExecuteRequest);

export interface ExecutionApplication {
  readonly execute: (input: {
    readonly actor: ApiKeyActorData;
    readonly idempotencyKey: string;
    readonly request: ExecuteRequest;
  }) => Effect.Effect<ExecuteResponse, BillingError | ExecutionError>;
}

export const makeExecutionApplication = Effect.gen(function* () {
  const audit = yield* Audit;
  const authConfig = yield* AuthConfig;
  const crypto = yield* CryptoService;
  const evm = yield* Evm;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const walletKeys = yield* WalletKeys;
  const createNotification = yield* makeCreateNotification;

  const loadAccount = Effect.fnUntraced(function* (wallet: WalletView) {
    if (wallet.wallet.status !== "active" || wallet.walletKey.status !== "active") {
      return yield* new ExecutionError({ code: "EXECUTION_UNAVAILABLE" });
    }
    const signer =
      wallet.walletKey.provider === "local"
        ? {
            provider: "local" as const,
            algorithm: wallet.walletKey.algorithm,
            data: Schema.decodeUnknownSync(LocalWalletKeyData)(wallet.walletKey.data),
          }
        : {
            provider: "gcp-kms" as const,
            algorithm: wallet.walletKey.algorithm,
            data: Schema.decodeUnknownSync(GcpWalletKeyData)(wallet.walletKey.data),
          };
    const owner = createWalletKeyWebAuthnAccount({
      id: wallet.walletKey.id,
      publicKey: wallet.walletKey.publicKeyHex,
      origin: authConfig.dashboardPublicOrigin.origin,
      rpId: authConfig.dashboardPublicOrigin.hostname,
      validatorType: "webauthn_p256",
      sign: (payload) => Effect.runPromise(walletKeys.signMessage({ ...signer, message: payload })),
    });
    return { wallet: wallet.wallet.data, owner } as const;
  });

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
      if (state === undefined)
        return yield* Effect.die("Policy state is missing after initialization");
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
    return yield* Effect.flatMap(
      Effect.forEach(sessionKey.policies, (policy) =>
        repository.core.sessionKeyPolicyState.findForPolicyForUpdate(
          organizationId,
          sessionKey.id,
          policy.id,
        ),
      ),
      (states) => Effect.succeed(states.flat()),
    );
  });

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
    if (submission.data.userOperationHash === null) {
      return yield* new ExecutionError({ code: "EXECUTION_UNAVAILABLE" });
    }
    return {
      namespace: "eip155" as const,
      status: "submitted" as const,
      submissionId: submission.id,
      userOperationHash: submission.data.userOperationHash,
    };
  });

  const release = Effect.fnUntraced(function* (
    organizationId: OrganizationId,
    actorId: ActorId,
    submissionId: ExecutionSubmissionId,
    sessionKey: EvmSessionKey,
    stage: "sign" | "submit" | "receipt",
  ) {
    yield* transaction.run(
      Effect.gen(function* () {
        const submission = yield* repository.core.executionSubmission.findByIdForUpdate(
          submissionId,
          organizationId,
        );
        if (
          submission === undefined ||
          submission.status === "confirmed" ||
          submission.status === "failed"
        )
          return;
        const states = yield* loadLockedStates(organizationId, sessionKey, submission.data.chainId);
        const reservations = yield* repository.core.sessionKeyPolicyReservation.findForSubmission(
          organizationId,
          submissionId,
        );
        const changes = yield* evm.policy.release({
          policies: sessionKey.policies,
          states,
          reservations,
        });
        yield* applyStateChanges(organizationId, states, changes);
        const now = yield* DateTime.now;
        yield* repository.core.sessionKeyPolicyReservation.markReleased(
          organizationId,
          submissionId,
          now,
        );
        yield* repository.core.executionSubmission.markFailed({
          id: submissionId,
          organizationId,
          failedAt: now,
        });
        yield* audit.organization({
          organizationId,
          actorId,
          event: "execution.failed",
          resourceType: "execution-submission",
          resourceId: submissionId,
          data: { version: 1, namespace: "eip155", chainId: submission.data.chainId, stage },
        });
      }),
    );
  });

  const execute = Effect.fn("application.execution.execute")(
    function* (input: {
      readonly actor: ApiKeyActorData;
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
      const account = yield* loadAccount(wallet);
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
      let lastPolicyCode: string | undefined;
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
          lastPolicyCode = decision.code;
          continue;
        }

        const reserved = yield* transaction
          .run(
            Effect.gen(function* () {
              yield* lockOrganizationBilling(repository, input.actor.organizationId);
              yield* enforceExecutionLimit(repository, input.actor.organizationId);
              const states = yield* loadLockedStates(
                input.actor.organizationId,
                candidate.sessionKey,
                input.request.chainId,
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
                  userOperation: null,
                  userOperationHash: null,
                },
              });
              if (!inserted.inserted)
                return yield* new ExistingSubmission({ id: inserted.submission.id });
              yield* applyStateChanges(input.actor.organizationId, states, plan.stateChanges);
              const reservationNow = yield* DateTime.now;
              yield* repository.core.sessionKeyPolicyReservation.insertMany(
                plan.reservations.map((reservation) => ({
                  organizationId: input.actor.organizationId,
                  sessionKeyId: candidate.sessionKey.id,
                  policyId: reservation.policyId,
                  executionSubmissionId: inserted.submission.id,
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
          lastPolicyCode = reserved.decision.code;
          continue;
        }
        selected = candidate;
        submissionId = reserved.submissionId;
        break;
      }

      if (selected === undefined || submissionId === undefined) {
        return yield* new ExecutionError({ code: "POLICY_DENIED", policyCode: lastPolicyCode });
      }

      const signed = yield* evm.execution.sign({ account, prepared }).pipe(
        Effect.tapError(() =>
          release(
            input.actor.organizationId,
            input.actor.actorId,
            submissionId,
            selected.sessionKey,
            "sign",
          ).pipe(Effect.orDie),
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
          userOperation: signed.userOperation,
          userOperationHash: signed.userOperationHash,
        },
      });

      const submitted = yield* evm.execution.submit({ signed }).pipe(Effect.result);
      if (
        Result.isFailure(submitted) &&
        (!Predicate.isTagged(submitted.failure, "EvmExecutionError") ||
          submitted.failure.code !== "SUBMISSION_UNKNOWN")
      ) {
        yield* release(
          input.actor.organizationId,
          input.actor.actorId,
          submissionId,
          selected.sessionKey,
          "submit",
        );
        return yield* new ExecutionError({ code: "EXECUTION_FAILED" });
      }
      const now = yield* DateTime.now;
      yield* transaction.run(
        Effect.gen(function* () {
          yield* repository.core.executionSubmission.markSubmitted({
            id: submissionId,
            organizationId: input.actor.organizationId,
            submittedAt: now,
            nextReconcileAt: DateTime.addDuration(now, Duration.minutes(1)),
          });
          yield* repository.core.sessionKeyPolicyReservation.markSubmitted(
            input.actor.organizationId,
            submissionId,
            now,
          );
          yield* audit.organization({
            organizationId: input.actor.organizationId,
            actorId: input.actor.actorId,
            event: "execution.submitted",
            resourceType: "execution-submission",
            resourceId: submissionId,
            data: {
              version: 1,
              namespace: "eip155",
              chainId: input.request.chainId,
              sessionKeyGrantId: selected.grant.id,
              userOperationHash: signed.userOperationHash,
            },
          });
        }),
      );

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
        yield* release(
          input.actor.organizationId,
          input.actor.actorId,
          submissionId,
          selected.sessionKey,
          "receipt",
        );
        return yield* new ExecutionError({ code: "EXECUTION_FAILED" });
      }

      const execution = yield* transaction.run(
        Effect.gen(function* () {
          const states = yield* loadLockedStates(
            input.actor.organizationId,
            selected.sessionKey,
            input.request.chainId,
          );
          const reservations = yield* repository.core.sessionKeyPolicyReservation.findForSubmission(
            input.actor.organizationId,
            submissionId,
          );
          const changes = yield* evm.policy.settle({
            policies: selected.sessionKey.policies,
            states,
            reservations,
            result: receipt,
          });
          yield* applyStateChanges(input.actor.organizationId, states, changes);
          yield* repository.core.sessionKeyPolicyReservation.markSettled(
            input.actor.organizationId,
            submissionId,
            yield* DateTime.now,
          );
          const created = yield* repository.core.execution.insert({
            executionSubmissionId: submissionId,
            organizationId: input.actor.organizationId,
            sessionKeyGrantId: selected.grant.id,
            namespace: "eip155",
            data: {
              version: 1,
              chainId: input.request.chainId,
              calls: input.request.calls,
              userOperationHash: receipt.userOperationHash,
              transactionHash: receipt.transactionHash,
              receipt,
            },
          });
          yield* repository.core.executionSubmission.markConfirmed({
            id: submissionId,
            organizationId: input.actor.organizationId,
            confirmedAt: yield* DateTime.now,
          });
          const event = yield* audit.organization({
            organizationId: input.actor.organizationId,
            actorId: input.actor.actorId,
            event: "execution.confirmed",
            resourceType: "execution",
            resourceId: created.id,
            data: {
              version: 1,
              namespace: "eip155",
              chainId: input.request.chainId,
              submissionId,
              transactionHash: receipt.transactionHash,
              userOperationHash: receipt.userOperationHash,
            },
          });
          const organization = yield* repository.auth.organization.findById(
            input.actor.organizationId,
          );
          if (organization === undefined)
            return yield* Effect.die("Execution organization is missing");
          const members = yield* repository.auth.member.findOrganizationMembersForOrg(
            input.actor.organizationId,
          );
          const notificationNow = yield* DateTime.now;
          yield* createNotification({
            organizationId: input.actor.organizationId,
            actorId: input.actor.actorId,
            type: "execution.confirmed",
            resourceType: "execution",
            resourceId: created.id,
            data: {
              version: 1,
              namespace: "eip155",
              chainId: input.request.chainId,
              transactionHash: receipt.transactionHash,
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
                    notificationNow,
                    notificationPolicy["execution.confirmed"].emailTimeToLive,
                  ),
                  variables: {
                    organizationName: organization.metadata.name,
                    walletName: wallet.wallet.metadata.name,
                    chainId: input.request.chainId,
                    transactionHash: receipt.transactionHash,
                  },
                },
              })),
          });
          return created;
        }),
      );

      yield* Metric.update(
        Metric.withAttributes(executionResults, { namespace: "eip155", result: "confirmed" }),
        1,
      );
      yield* Effect.logInfo("execution.confirmed").pipe(
        Effect.annotateLogs({ namespace: "eip155", chain_id: input.request.chainId }),
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

  return { execute } satisfies ExecutionApplication;
});
