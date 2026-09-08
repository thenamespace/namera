import { DateTime, Duration, Effect, Metric, Schema } from "effect";

import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository, TransactionService } from "@namera-ai/database";
import { Evm } from "@namera-ai/evm";
import { SignatureError } from "@namera-ai/protocol";
import {
  PrepareSignatureRequest,
  type PrepareSignatureResponse,
  type GrantedActorData,
} from "@namera-ai/protocol/dto";
import { signatureDuration, signatureResults } from "@namera-ai/telemetry";
import { utf8ByteLength } from "@namera-ai/utils";

import { Audit } from "#/audit/layer";
import { makeBillingMetering } from "#/billing/index";

import { makeSignatureAuthority } from "./authority.js";

export const makePrepareSignature = Effect.gen(function* () {
  const crypto = yield* CryptoService;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const evm = yield* Evm;
  const billing = yield* makeBillingMetering;
  const audit = yield* Audit;
  const authority = yield* makeSignatureAuthority;

  return Effect.fn("application.signature.prepare")(
    function* (input: {
      readonly actor: GrantedActorData;
      readonly idempotencyKey: string;
      readonly request: PrepareSignatureRequest;
    }) {
      const { request, actor } = input;
      const requestHash = yield* crypto.hash({
        purpose: cryptoPurpose.signatureRequest,
        value: JSON.stringify(Schema.encodeSync(PrepareSignatureRequest)(request)),
      });
      const prior = yield* repository.core.signatureOperation.findByActorAndIdempotencyKey(
        actor.organizationId,
        actor.actorId,
        input.idempotencyKey,
      );
      if (prior !== undefined && prior.requestHash !== requestHash)
        return yield* new SignatureError({ code: "IDEMPOTENCY_CONFLICT" });
      const scope = { ...request, actor };
      const selected = yield* authority.load(scope);
      yield* authority.evaluate(selected, request);
      const typedData = yield* evm.sessionSignatures
        .prepare({
          ...request,
          account: selected.account,
          session: selected.installation.data,
        })
        .pipe(
          Effect.mapError(
            (error) =>
              new SignatureError({
                code:
                  "code" in error && error.code === "NETWORK_PAUSED"
                    ? "NETWORK_PAUSED"
                    : "SIGNING_FAILED",
              }),
          ),
        );
      const payloadDigest = yield* evm
        .digestSignature(request)
        .pipe(Effect.mapError(() => new SignatureError({ code: "SIGNING_FAILED" })));
      const operation =
        prior ??
        (yield* transaction.run(
          Effect.gen(function* () {
            yield* repository.core.wallet.findByIdForUpdate(request.walletId, actor.organizationId);
            const current = yield* authority.load({ ...scope, forUpdate: true });
            yield* authority.evaluate(current, request);
            if (current.installation.id !== selected.installation.id)
              return yield* new SignatureError({ code: "SIGNATURE_UNAVAILABLE" });
            const now = yield* DateTime.now;
            const reservationExpiresAt = evm.policy.authorizationDeadline({
              policies: current.sessionKey.policies,
              latest: DateTime.makeUnsafe(
                Math.min(
                  DateTime.toEpochMillis(DateTime.addDuration(now, Duration.minutes(5))),
                  current.installation.data.authorization.validUntil * 1000,
                ),
              ),
            });
            const payloadSizeBytes = utf8ByteLength(
              request.type === "message" ? request.message : JSON.stringify(request.typedData),
            );
            const common = {
              organizationId: actor.organizationId,
              actorId: actor.actorId,
              walletId: request.walletId,
              sessionKeyId: request.sessionKeyId,
              sessionKeyGrantId: current.grant.id,
              idempotencyKey: input.idempotencyKey,
              requestHash,
              policyHash: current.sessionKey.policyHash,
              reservationExpiresAt,
              namespace: "eip155" as const,
            };
            const commonData = {
              version: 1 as const,
              chainId: request.chainId,
              account: current.wallet.wallet.data.address,
              payloadDigest,
              payloadSizeBytes,
            };
            const inserted = yield* repository.core.signatureOperation.insert(
              request.type === "message"
                ? { ...common, data: { ...commonData, type: "message", message: request.message } }
                : {
                    ...common,
                    data: { ...commonData, type: "typed-data", typedData: request.typedData },
                  },
            );
            if (!inserted.inserted) {
              if (inserted.operation.requestHash !== requestHash)
                return yield* new SignatureError({ code: "IDEMPOTENCY_CONFLICT" });
              return inserted.operation;
            }
            yield* billing.reserve({
              organizationId: actor.organizationId,
              meterKey: "signature",
              amount: 1n,
              sourceType: "signature-operation",
              sourceId: inserted.operation.id,
              expiresAt: reservationExpiresAt,
            });
            yield* audit.organization({
              organizationId: actor.organizationId,
              actorId: actor.actorId,
              event: "signature.prepared",
              resourceType: "wallet",
              resourceId: request.walletId,
              data: {
                version: 1,
                namespace: "eip155",
                chainId: request.chainId,
                type: request.type,
                sessionKeyGrantId: current.grant.id,
              },
            });
            yield* Metric.update(
              Metric.withAttributes(signatureResults, {
                namespace: "eip155",
                type: request.type,
                result: "prepared",
              }),
              1,
            );
            return inserted.operation;
          }),
        ));
      if (
        operation.status === "failed" ||
        DateTime.toEpochMillis(operation.reservationExpiresAt) <=
          DateTime.toEpochMillis(yield* DateTime.now)
      )
        return yield* new SignatureError({ code: "SIGNATURE_UNAVAILABLE" });
      return {
        namespace: "eip155",
        operationId: operation.id,
        installationId: selected.installation.id,
        signingKeyId: selected.signer.id,
        request,
        signing: { method: "eth_signTypedData_v4", typedData },
        expiresAt: operation.reservationExpiresAt,
      } satisfies PrepareSignatureResponse;
    },
    Effect.trackDuration(Metric.withAttributes(signatureDuration, { stage: "prepare" })),
    Effect.catchTag("DatabaseError", Effect.die),
    Effect.catchTag("EvmPolicyError", () => new SignatureError({ code: "SIGNATURE_UNAVAILABLE" })),
  );
});
