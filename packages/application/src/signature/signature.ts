import { DateTime, Duration, Effect, Metric, Schema } from "effect";

import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository, TransactionService } from "@namera-ai/database";
import { Evm } from "@namera-ai/evm";
import {
  SignatureError,
  type BillingError,
  type EvmPolicyDeniedDecision,
  type SignatureOperationId,
} from "@namera-ai/protocol";
import {
  SignRequest,
  type GrantedActorData,
  type SignRequest as SignRequestType,
  type SignResponse,
} from "@namera-ai/protocol/dto";
import type { EvmSessionKey, SessionKeyGrant } from "@namera-ai/protocol/model";
import {
  signatureDuration,
  signaturePolicyDecisions,
  signatureResults,
} from "@namera-ai/telemetry";

import { Audit } from "#/audit/layer";
import { enforceSignatureLimit, lockOrganizationBilling } from "#/billing/index";
import { makeLoadEvmAccount } from "#/wallet/account";

type GrantedSessionKey = {
  readonly grant: SessionKeyGrant;
  readonly sessionKey: EvmSessionKey;
};

const encodeRequest = Schema.encodeSync(SignRequest);
const textEncoder = new TextEncoder();

export interface SignatureApplication {
  readonly sign: (input: {
    readonly actor: GrantedActorData;
    readonly idempotencyKey: string;
    readonly request: SignRequestType;
  }) => Effect.Effect<SignResponse, BillingError | SignatureError>;
}

export const makeSignatureApplication = Effect.gen(function* () {
  const audit = yield* Audit;
  const crypto = yield* CryptoService;
  const evm = yield* Evm;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const loadEvmAccount = yield* makeLoadEvmAccount;

  const failOperation = Effect.fn("application.signature.failOperation")(function* (input: {
    readonly organizationId: GrantedActorData["organizationId"];
    readonly operationId: SignatureOperationId;
  }) {
    yield* transaction.run(
      Effect.gen(function* () {
        const operation = yield* repository.core.signatureOperation.findByIdForUpdate(
          input.operationId,
          input.organizationId,
        );
        if (operation === undefined || operation.status !== "reserved") return;

        yield* repository.core.signatureOperation.markFailed({
          id: operation.id,
          organizationId: operation.organizationId,
          failureCode: "SIGNING_FAILED",
          failedAt: yield* DateTime.now,
        });
      }),
    );
  });

  const succeedOperation = Effect.fn("application.signature.succeedOperation")(function* (input: {
    readonly actor: GrantedActorData;
    readonly operationId: SignatureOperationId;
  }) {
    yield* transaction.run(
      Effect.gen(function* () {
        const operation = yield* repository.core.signatureOperation.findByIdForUpdate(
          input.operationId,
          input.actor.organizationId,
        );
        if (operation === undefined || operation.status !== "reserved") {
          return yield* Effect.die("Signature operation reservation is missing");
        }

        const succeeded = yield* repository.core.signatureOperation.markSucceeded({
          id: operation.id,
          organizationId: operation.organizationId,
          succeededAt: yield* DateTime.now,
        });
        if (succeeded === undefined) {
          return yield* Effect.die("Signature operation could not be completed");
        }

        yield* audit.organization({
          organizationId: input.actor.organizationId,
          actorId: input.actor.actorId,
          event: "signature.created",
          resourceType: "wallet",
          resourceId: operation.walletId,
          data: {
            version: 1,
            namespace: "eip155",
            chainId: operation.data.chainId,
            type: operation.data.type,
            sessionKeyGrantId: operation.sessionKeyGrantId,
          },
        });
      }),
    );
  });

  const sign = Effect.fn("application.signature.sign")(
    function* (input: {
      readonly actor: GrantedActorData;
      readonly idempotencyKey: string;
      readonly request: SignRequestType;
    }) {
      const encodedRequest = encodeRequest(input.request);
      const requestHash = yield* crypto.hash({
        purpose: cryptoPurpose.signatureRequest,
        value: JSON.stringify(encodedRequest),
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

      const wallet = yield* repository.core.wallet.findById(
        input.request.walletId,
        input.actor.organizationId,
      );
      if (wallet === undefined || wallet.wallet.namespace !== input.request.namespace) {
        return yield* new SignatureError({ code: "SIGNATURE_UNAVAILABLE" });
      }
      const account = yield* loadEvmAccount(wallet).pipe(
        Effect.mapError(() => new SignatureError({ code: "SIGNATURE_UNAVAILABLE" })),
      );
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
      const payloadSizeBytes = textEncoder.encode(
        input.request.type === "message"
          ? input.request.message
          : JSON.stringify(input.request.typedData),
      ).byteLength;
      const candidates = input.actor.grants.filter(
        (item): item is GrantedSessionKey =>
          item.sessionKey.namespace === "eip155" &&
          item.sessionKey.walletId === input.request.walletId &&
          item.sessionKey.status === "active" &&
          item.sessionKey.policies.some((policy) => policy.type === "evm.signature"),
      );
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
            : {
                policyId: lastPolicyDenial.policyId,
                policyCode: lastPolicyDenial.code,
              }),
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
            failOperation({
              organizationId: input.actor.organizationId,
              operationId,
            }).pipe(Effect.orDie),
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

      yield* succeedOperation({ actor: input.actor, operationId });
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

  return { sign } satisfies SignatureApplication;
});
