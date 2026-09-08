import { DateTime, Duration, Effect, Schema } from "effect";

import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository, TransactionService } from "@namera-ai/database";
import { Evm } from "@namera-ai/evm";
import {
  Bytes32,
  ExecutionError,
  type BillingError,
  type DatabaseError,
  type EvmPolicyError,
} from "@namera-ai/protocol";
import {
  PrepareExecutionRequest,
  type GrantedActorData,
  type PrepareExecutionResponse,
} from "@namera-ai/protocol/dto";

import { Audit } from "#/audit/layer";
import { makeBillingMetering } from "#/billing/index";
import { makeExecutionLifecycle } from "#/execution/lifecycle";

import { makeLoadExecutionAuthority } from "./authority.js";
import { makePrepareExecution } from "./preparation.js";

export const makePrepareLocalExecution = Effect.gen(function* () {
  const crypto = yield* CryptoService;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const evm = yield* Evm;
  const billing = yield* makeBillingMetering;
  const audit = yield* Audit;
  const lifecycle = yield* makeExecutionLifecycle;
  const loadAuthority = yield* makeLoadExecutionAuthority;
  const prepareExecution = yield* makePrepareExecution;

  return Effect.fn("application.execution.prepareLocal")(
    function* (input: {
      readonly actor: GrantedActorData;
      readonly idempotencyKey: string;
      readonly request: PrepareExecutionRequest;
    }): Effect.fn.Return<
      PrepareExecutionResponse,
      ExecutionError | DatabaseError | BillingError | EvmPolicyError
    > {
      const request = { ...input.request, sponsor: input.request.sponsor ?? true };
      const requestHash = yield* crypto.hash({
        purpose: cryptoPurpose.executionRequest,
        value: JSON.stringify(Schema.encodeSync(PrepareExecutionRequest)(request)),
      });
      const prior = yield* repository.core.executionSubmission.findByActorAndIdempotencyKey(
        input.actor.organizationId,
        input.actor.actorId,
        input.idempotencyKey,
      );
      if (prior !== undefined && prior.requestHash !== requestHash)
        return yield* new ExecutionError({ code: "IDEMPOTENCY_CONFLICT" });
      const { authority, prepared } =
        prior === undefined
          ? yield* prepareExecution({ actor: input.actor, request })
          : {
              authority: yield* loadAuthority({ ...request, actor: input.actor }),
              prepared: prior.data.prepared,
            };

      const submission =
        prior ??
        (yield* transaction.run(
          Effect.gen(function* () {
            // Serialize with session installation/revocation, then lock the grant so
            // API-key/OAuth revocation cannot commit between admission and reservation.
            yield* repository.core.wallet.findByIdForUpdate(
              request.walletId,
              input.actor.organizationId,
            );
            const current = yield* loadAuthority({
              ...request,
              actor: input.actor,
              forUpdate: true,
            });
            if (current.installation.id !== authority.installation.id)
              return yield* new ExecutionError({ code: "EXECUTION_UNAVAILABLE" });
            const existing =
              yield* repository.core.executionSubmission.findByActorAndIdempotencyKey(
                input.actor.organizationId,
                input.actor.actorId,
                input.idempotencyKey,
              );
            if (existing !== undefined) {
              if (existing.requestHash !== requestHash)
                return yield* new ExecutionError({ code: "IDEMPOTENCY_CONFLICT" });
              return existing;
            }
            const states = yield* lifecycle.initializeAndLockStates(
              input.actor.organizationId,
              current.sessionKey,
              prepared.context,
            );
            const plan = yield* evm.policy.reserve({
              policies: current.sessionKey.policies,
              context: prepared.context,
              states,
            });
            if (!plan.decision.allowed)
              return yield* new ExecutionError({
                code: "POLICY_DENIED",
                policyId: plan.decision.policyId,
                policyCode: plan.decision.code,
              });
            const now = yield* DateTime.now;
            const latest = DateTime.makeUnsafe(
              Math.min(
                DateTime.toEpochMillis(DateTime.addDuration(now, Duration.minutes(5))),
                current.installation.data.authorization.validUntil * 1000,
              ),
            );
            const expiresAt = evm.policy.authorizationDeadline({
              policies: current.sessionKey.policies,
              latest,
            });
            if (DateTime.toEpochMillis(expiresAt) <= DateTime.toEpochMillis(now))
              return yield* new ExecutionError({ code: "EXECUTION_UNAVAILABLE" });
            const inserted = yield* repository.core.executionSubmission.insert({
              organizationId: input.actor.organizationId,
              actorId: input.actor.actorId,
              sessionKeyGrantId: current.grant.id,
              sessionKeyId: current.sessionKey.id,
              installationId: current.installation.id,
              expiresAt,
              idempotencyKey: input.idempotencyKey,
              requestHash,
              policyHash: current.sessionKey.policyHash,
              namespace: "eip155",
              data: {
                version: 1,
                chainId: request.chainId,
                calls: request.calls,
                prepared,
                signedExecution: null,
              },
            });
            if (!inserted.inserted) {
              if (inserted.submission.requestHash !== requestHash)
                return yield* new ExecutionError({ code: "IDEMPOTENCY_CONFLICT" });
              return inserted.submission;
            }
            yield* lifecycle.applyStateChanges(
              input.actor.organizationId,
              states,
              plan.stateChanges,
            );
            yield* repository.core.sessionKeyPolicyReservation.insertMany(
              plan.reservations.map((reservation) => ({
                organizationId: input.actor.organizationId,
                sessionKeyId: current.sessionKey.id,
                policyId: reservation.policyId,
                executionSubmissionId: inserted.submission.id,
                signatureOperationId: null,
                stateKey: reservation.stateKey,
                reservationVersion: reservation.reservationVersion,
                data: reservation.data,
                expiresAt,
              })),
            );
            const source = {
              organizationId: input.actor.organizationId,
              sourceType: "execution-submission" as const,
              sourceId: inserted.submission.id,
              expiresAt,
            };
            yield* billing.reserve({
              ...source,
              meterKey: prepared.billing.executionMeter,
              amount: 1n,
            });
            if (
              prepared.billing.sponsorship !== null &&
              prepared.billing.sponsorship.reservationAmountMicroUsd > 0n
            )
              yield* billing.reserve({
                ...source,
                meterKey: "gas-sponsorship",
                amount: prepared.billing.sponsorship.reservationAmountMicroUsd,
              });
            yield* audit.organization({
              organizationId: input.actor.organizationId,
              actorId: input.actor.actorId,
              event: "execution.prepared",
              resourceType: "execution-submission",
              resourceId: inserted.submission.id,
              data: {
                version: 1,
                namespace: "eip155",
                chainId: request.chainId,
                sessionKeyGrantId: current.grant.id,
              },
            });
            return inserted.submission;
          }),
        ));
      if (
        submission.status === "failed" ||
        DateTime.toEpochMillis(submission.expiresAt) <= DateTime.toEpochMillis(yield* DateTime.now)
      )
        return yield* new ExecutionError({ code: "EXECUTION_UNAVAILABLE" });
      const message = yield* evm.execution
        .sessionSigningMessage({
          account: authority.account,
          session: authority.installation.data,
          prepared: submission.data.prepared,
        })
        .pipe(Effect.mapError(() => new ExecutionError({ code: "EXECUTION_FAILED" })));
      return {
        namespace: "eip155",
        submissionId: submission.id,
        sessionKeyId: submission.sessionKeyId,
        installationId: submission.installationId,
        signingKeyId: authority.signer.id,
        prepared: submission.data.prepared,
        signing: { method: "personal_sign", message: Schema.decodeSync(Bytes32)(message) },
        expiresAt: submission.expiresAt,
      };
    },
    Effect.catchTag("DatabaseError", Effect.die),
    Effect.catchTag("EvmPolicyError", () => new ExecutionError({ code: "EXECUTION_UNAVAILABLE" })),
  );
});
