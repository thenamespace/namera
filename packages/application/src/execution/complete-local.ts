import { DateTime, Duration, Effect, Metric, Schema } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import { Evm } from "@namera-ai/evm";
import { ExecutionError, Hex, type DatabaseError, type EvmPolicyError } from "@namera-ai/protocol";
import type {
  CompleteExecutionRequest,
  CompleteExecutionResponse,
  GrantedActorData,
  CompleteManagedExecutionRequest,
} from "@namera-ai/protocol/dto";
import { executionDuration, executionResults } from "@namera-ai/telemetry";
import { generateUniqueId } from "@namera-ai/utils";

import { Audit } from "#/audit/layer";
import { makeLoadOneClawSessionSigner, sessionSignerBinding } from "#/oneclaw/session-signer";

import { makeLoadExecutionAuthority } from "./authority.js";

export const makeCompleteLocalExecution = Effect.gen(function* () {
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const evm = yield* Evm;
  const loadAuthority = yield* makeLoadExecutionAuthority;
  const audit = yield* Audit;
  const loadSigner = yield* makeLoadOneClawSessionSigner;
  return Effect.fn("application.execution.completeLocal")(
    function* (input: {
      readonly actor: GrantedActorData;
      readonly request: CompleteExecutionRequest | CompleteManagedExecutionRequest;
      readonly custody?: "local" | "namera-managed";
    }): Effect.fn.Return<
      CompleteExecutionResponse,
      ExecutionError | DatabaseError | EvmPolicyError
    > {
      const submission = yield* repository.core.executionSubmission.findByIdForActor(
        input.request.submissionId,
        input.actor.organizationId,
        input.actor.actorId,
      );
      const managed = input.custody === "namera-managed";
      if (
        submission === undefined ||
        (submission.data.managedSignerBinding !== undefined) !== managed
      )
        return yield* new ExecutionError({ code: "EXECUTION_UNAVAILABLE" });
      if (submission.status !== "reserved" && submission.data.signedExecution !== null)
        return {
          namespace: "eip155",
          submissionId: submission.id,
          status: submission.status,
          userOperationHash: submission.data.signedExecution.userOperationHash,
        };
      if (
        submission.status !== "reserved" ||
        DateTime.toEpochMillis(submission.expiresAt) <= DateTime.toEpochMillis(yield* DateTime.now)
      )
        return yield* new ExecutionError({ code: "EXECUTION_UNAVAILABLE" });
      const grant = input.actor.grants.find(
        (candidate) => candidate.grant.id === submission.sessionKeyGrantId,
      );
      if (grant === undefined)
        return yield* new ExecutionError({ code: "NO_AUTHORIZED_SESSION_KEY" });
      const scope = {
        actor: input.actor,
        walletId: grant.sessionKey.walletId,
        sessionKeyId: submission.sessionKeyId,
        chainId: submission.data.chainId,
        custody: input.custody ?? "local",
      };
      const authority = yield* loadAuthority(scope);
      if (authority.installation.id !== submission.installationId)
        return yield* new ExecutionError({ code: "EXECUTION_UNAVAILABLE" });
      if (
        authority.sessionKey.policyHash !== submission.policyHash ||
        (managed && sessionSignerBinding(authority.signer) !== submission.data.managedSignerBinding)
      )
        return yield* new ExecutionError({ code: "EXECUTION_UNAVAILABLE" });
      const initialDecision = yield* evm.policy.evaluate({
        policies: authority.sessionKey.policies,
        context: submission.data.prepared.context,
      });
      if (!initialDecision.allowed)
        return yield* new ExecutionError({
          code: "POLICY_DENIED",
          policyId: initialDecision.policyId,
          policyCode: initialDecision.code,
        });
      const leaseToken = generateUniqueId();
      const signature = yield* Effect.gen(function* () {
        if (!managed) {
          if (!("signature" in input.request))
            return yield* new ExecutionError({ code: "EXECUTION_UNAVAILABLE" });
          return input.request.signature;
        }
        const now = yield* DateTime.now;
        const claimed = yield* repository.core.executionSubmission.claimForSigning({
          id: submission.id,
          organizationId: input.actor.organizationId,
          actorId: input.actor.actorId,
          leaseToken,
          now,
          leaseExpiresAt: DateTime.addDuration(now, Duration.minutes(2)),
        });
        if (!claimed) return yield* new ExecutionError({ code: "EXECUTION_UNAVAILABLE" });
        // A lost/failed provider call keeps its lease until timeout. Takeover signs
        // the same immutable UserOperation; it never creates a new economic action.
        const signer = yield* loadSigner(authority.signer).pipe(
          Effect.mapError(() => new ExecutionError({ code: "EXECUTION_FAILED" })),
        );
        const message = yield* evm.execution
          .sessionSigningMessage({
            account: authority.account,
            session: authority.installation.data,
            prepared: submission.data.prepared,
          })
          .pipe(Effect.mapError(() => new ExecutionError({ code: "EXECUTION_FAILED" })));
        return yield* Effect.tryPromise({
          try: () => signer.signMessage({ message: { raw: message } }),
          catch: () => new ExecutionError({ code: "EXECUTION_FAILED" }),
        }).pipe(Effect.map(Schema.decodeSync(Hex)));
      });
      const signed = yield* evm.execution
        .completeSessionExecution({
          account: authority.account,
          session: authority.installation.data,
          prepared: submission.data.prepared,
          signature,
        })
        .pipe(
          Effect.mapError(
            (error) =>
              new ExecutionError({
                code:
                  "code" in error && error.code === "NETWORK_PAUSED"
                    ? "NETWORK_PAUSED"
                    : "EXECUTION_FAILED",
              }),
          ),
        );

      const accepted = yield* transaction.run(
        Effect.gen(function* () {
          yield* repository.core.wallet.findByIdForUpdate(
            scope.walletId,
            input.actor.organizationId,
          );
          const current = yield* loadAuthority({ ...scope, forUpdate: true });
          const existing = yield* repository.core.executionSubmission.findByIdForUpdate(
            submission.id,
            input.actor.organizationId,
          );
          if (existing === undefined)
            return yield* new ExecutionError({ code: "EXECUTION_UNAVAILABLE" });
          if (existing.status !== "reserved" && existing.data.signedExecution !== null)
            return existing;
          if (
            current.installation.id !== submission.installationId ||
            current.sessionKey.policyHash !== submission.policyHash ||
            current.signer.id !== authority.signer.id ||
            (managed &&
              sessionSignerBinding(current.signer) !== submission.data.managedSignerBinding)
          )
            return yield* new ExecutionError({ code: "EXECUTION_UNAVAILABLE" });
          // Check stateless policies again; the attempt already owns its stateful reservation.
          const decision = yield* evm.policy.evaluate({
            policies: current.sessionKey.policies,
            context: submission.data.prepared.context,
          });
          if (!decision.allowed)
            return yield* new ExecutionError({
              code: "POLICY_DENIED",
              policyId: decision.policyId,
              policyCode: decision.code,
            });
          const now = yield* DateTime.now;
          const updated = yield* repository.core.executionSubmission.acceptSignature({
            id: submission.id,
            organizationId: input.actor.organizationId,
            actorId: input.actor.actorId,
            requestHash: submission.requestHash,
            signed,
            now,
            nextReconcileAt: DateTime.addDuration(now, Duration.seconds(1)),
            ...(managed ? { leaseToken } : {}),
          });
          if (updated === undefined)
            return yield* new ExecutionError({ code: "EXECUTION_UNAVAILABLE" });
          yield* audit.organization({
            organizationId: input.actor.organizationId,
            actorId: input.actor.actorId,
            event: "execution.signature_accepted",
            resourceType: "execution-submission",
            resourceId: updated.id,
            data: {
              version: 1,
              namespace: "eip155",
              chainId: updated.data.chainId,
              sessionKeyGrantId: updated.sessionKeyGrantId,
            },
          });
          return updated;
        }),
      );
      if (accepted.status === "reserved" || accepted.data.signedExecution === null)
        return yield* new ExecutionError({ code: "EXECUTION_UNAVAILABLE" });
      return {
        namespace: "eip155",
        submissionId: accepted.id,
        status: accepted.status,
        userOperationHash: accepted.data.signedExecution.userOperationHash,
      };
    },
    Effect.catchTag("DatabaseError", Effect.die),
    Effect.catchTag("EvmPolicyError", () => new ExecutionError({ code: "EXECUTION_UNAVAILABLE" })),
    Effect.tap(() =>
      Metric.update(
        Metric.withAttributes(executionResults, { stage: "complete", result: "success" }),
        1,
      ),
    ),
    Effect.tapError((error) =>
      Metric.update(
        Metric.withAttributes(executionResults, { stage: "complete", result: error.code }),
        1,
      ),
    ),
    Effect.trackDuration(Metric.withAttributes(executionDuration, { stage: "complete" })),
  );
});
