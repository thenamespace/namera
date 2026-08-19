import { DateTime, Duration, Effect, Metric, Schema } from "effect";

import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository, TransactionService } from "@namera-ai/database";
import { Evm } from "@namera-ai/evm";
import {
  SignatureError,
  type EvmPolicyDeniedDecision,
  type SignatureOperationId,
} from "@namera-ai/protocol";
import {
  SignRequest,
  type GrantedActorData,
  type SignRequest as SignRequestType,
  type SignResponse,
} from "@namera-ai/protocol/dto";
import {
  signatureDuration,
  signaturePolicyDecisions,
  signatureResults,
} from "@namera-ai/telemetry";
import { utf8ByteLength } from "@namera-ai/utils";

import { enforceSignatureLimit, lockOrganizationBilling } from "#/billing/index";

import { getSignatureCandidates, makeLoadSignatureAccount } from "./account.js";
import { makeSignatureOperationLifecycle } from "./lifecycle.js";

const encodeRequest = Schema.encodeSync(SignRequest);

export const makeSign = Effect.gen(function* () {
  const crypto = yield* CryptoService;
  const evm = yield* Evm;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const loadSignatureAccount = yield* makeLoadSignatureAccount;
  const lifecycle = yield* makeSignatureOperationLifecycle;

  return Effect.fn("application.signature.sign")(
    function* (input: {
      readonly actor: GrantedActorData;
      readonly idempotencyKey: string;
      readonly request: SignRequestType;
    }) {
      const requestHash = yield* crypto.hash({
        purpose: cryptoPurpose.signatureRequest,
        value: JSON.stringify(encodeRequest(input.request)),
      });
      const prior = yield* repository.core.signatureOperation.findByActorAndIdempotencyKey(
        input.actor.organizationId,
        input.actor.actorId,
        input.idempotencyKey,
      );
      if (prior !== undefined) {
        return yield* new SignatureError({
          code:
            prior.requestHash === requestHash ? "SIGNATURE_UNAVAILABLE" : "IDEMPOTENCY_CONFLICT",
        });
      }

      const { wallet, account } = yield* loadSignatureAccount({
        organizationId: input.actor.organizationId,
        request: input.request,
      });
      const timestamp = yield* DateTime.now;
      const context =
        input.request.type === "message"
          ? ({
              version: 1,
              namespace: "eip155",
              chainId: input.request.chainId,
              account: wallet.wallet.data.address,
              timestamp,
              type: "message",
              message: input.request.message,
            } as const)
          : ({
              version: 1,
              namespace: "eip155",
              chainId: input.request.chainId,
              account: wallet.wallet.data.address,
              timestamp,
              type: "typed-data",
              typedData: input.request.typedData,
            } as const);
      const payloadDigest = yield* evm
        .digestSignature(
          input.request.type === "message"
            ? { type: "message", message: input.request.message }
            : { type: "typed-data", typedData: input.request.typedData },
        )
        .pipe(Effect.mapError(() => new SignatureError({ code: "SIGNING_FAILED" })));
      const payloadSizeBytes = utf8ByteLength(
        input.request.type === "message"
          ? input.request.message
          : JSON.stringify(input.request.typedData),
      );
      const candidates = getSignatureCandidates(input.actor, input.request.walletId);
      if (candidates.length === 0) {
        yield* Metric.update(
          Metric.withAttributes(signatureResults, {
            namespace: "eip155",
            type: input.request.type,
            result: "no_authorized_session_key",
          }),
          1,
        );
        return yield* new SignatureError({ code: "NO_AUTHORIZED_SESSION_KEY" });
      }

      let operationId: SignatureOperationId | undefined;
      let lastPolicyDenial: EvmPolicyDeniedDecision | undefined;
      for (const candidate of candidates) {
        const decision = yield* evm.policy.evaluateSignature({
          policies: candidate.sessionKey.policies,
          context,
        });
        yield* Metric.update(
          Metric.withAttributes(signaturePolicyDecisions, {
            namespace: "eip155",
            type: input.request.type,
            result: decision.allowed ? "allowed" : "denied",
          }),
          1,
        );
        if (!decision.allowed) {
          if ("policyId" in decision) lastPolicyDenial = decision;
          continue;
        }

        const reserved = yield* transaction.run(
          Effect.gen(function* () {
            yield* lockOrganizationBilling(repository, input.actor.organizationId);
            const existing = yield* repository.core.signatureOperation.findByActorAndIdempotencyKey(
              input.actor.organizationId,
              input.actor.actorId,
              input.idempotencyKey,
            );
            if (existing !== undefined) return { existing } as const;

            yield* enforceSignatureLimit(repository, input.actor.organizationId);
            const reservationNow = yield* DateTime.now;
            const commonInsert = {
              organizationId: input.actor.organizationId,
              actorId: input.actor.actorId,
              walletId: wallet.wallet.id,
              sessionKeyId: candidate.sessionKey.id,
              sessionKeyGrantId: candidate.grant.id,
              idempotencyKey: input.idempotencyKey,
              requestHash,
              policyHash: candidate.sessionKey.policyHash,
              reservationExpiresAt: DateTime.addDuration(reservationNow, Duration.minutes(5)),
              namespace: "eip155" as const,
            };
            const inserted = yield* repository.core.signatureOperation.insert(
              input.request.type === "message"
                ? {
                    ...commonInsert,
                    data: {
                      version: 1,
                      chainId: input.request.chainId,
                      account: wallet.wallet.data.address,
                      type: "message",
                      message: input.request.message,
                      payloadDigest,
                      payloadSizeBytes,
                    },
                  }
                : {
                    ...commonInsert,
                    data: {
                      version: 1,
                      chainId: input.request.chainId,
                      account: wallet.wallet.data.address,
                      type: "typed-data",
                      typedData: input.request.typedData,
                      payloadDigest,
                      payloadSizeBytes,
                    },
                  },
            );
            return inserted.inserted
              ? ({ operation: inserted.operation } as const)
              : ({ existing: inserted.operation } as const);
          }),
        );
        if ("existing" in reserved) {
          return yield* new SignatureError({
            code:
              reserved.existing.requestHash === requestHash
                ? "SIGNATURE_UNAVAILABLE"
                : "IDEMPOTENCY_CONFLICT",
          });
        }

        operationId = reserved.operation.id;
        break;
      }
      if (operationId === undefined) {
        yield* Metric.update(
          Metric.withAttributes(signatureResults, {
            namespace: "eip155",
            type: input.request.type,
            result: "policy_denied",
          }),
          1,
        );
        return yield* new SignatureError({
          code: "POLICY_DENIED",
          ...(lastPolicyDenial === undefined
            ? {}
            : { policyId: lastPolicyDenial.policyId, policyCode: lastPolicyDenial.code }),
        });
      }

      const signature = yield* evm
        .sign({
          account,
          chainId: input.request.chainId,
          ...(input.request.type === "message"
            ? { type: "message" as const, message: input.request.message }
            : { type: "typed-data" as const, typedData: input.request.typedData }),
        })
        .pipe(
          Effect.tapError(() =>
            lifecycle
              .fail({ organizationId: input.actor.organizationId, operationId })
              .pipe(Effect.orDie),
          ),
          Effect.tapError(() =>
            Metric.update(
              Metric.withAttributes(signatureResults, {
                namespace: "eip155",
                type: input.request.type,
                result: "signing_failed",
              }),
              1,
            ),
          ),
          Effect.mapError(() => new SignatureError({ code: "SIGNING_FAILED" })),
        );

      yield* lifecycle.succeed({ actor: input.actor, operationId });
      yield* Metric.update(
        Metric.withAttributes(signatureResults, {
          namespace: "eip155",
          type: input.request.type,
          result: "success",
        }),
        1,
      );
      const response = {
        namespace: "eip155" as const,
        walletId: wallet.wallet.id,
        chainId: input.request.chainId,
        account: wallet.wallet.data.address,
        signature,
      };
      return input.request.type === "message"
        ? ({ ...response, type: "message" } satisfies SignResponse)
        : ({ ...response, type: "typed-data" } satisfies SignResponse);
    },
    Effect.trackDuration(signatureDuration),
    Effect.catchTag("DatabaseError", Effect.die),
    Effect.catchTag("EvmPolicyError", () => new SignatureError({ code: "SIGNATURE_UNAVAILABLE" })),
  );
});
