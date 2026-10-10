import { DateTime, Duration, Effect, Metric, Schema } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import { Evm } from "@namera-ai/evm";
import { SignatureError, Hex } from "@namera-ai/protocol";
import type {
  CompleteSignatureRequest,
  CompleteSignatureResponse,
  GrantedActorData,
  PrepareSignatureRequest,
  CompleteManagedSignatureRequest,
} from "@namera-ai/protocol/dto";
import { signatureDuration, signatureResults } from "@namera-ai/telemetry";
import { generateUniqueId } from "@namera-ai/utils";

import { makeLoadOneClawSessionSigner, sessionSignerBinding } from "#/oneclaw/session-signer";

import { makeSignatureAuthority } from "./authority.js";
import { makeSignatureOperationLifecycle } from "./lifecycle.js";

export const makeCompleteSignature = Effect.gen(function* () {
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const evm = yield* Evm;
  const authority = yield* makeSignatureAuthority;
  const lifecycle = yield* makeSignatureOperationLifecycle;
  const loadSigner = yield* makeLoadOneClawSessionSigner;
  return Effect.fn("application.signature.complete")(
    function* (input: {
      readonly actor: GrantedActorData;
      readonly request: CompleteSignatureRequest | CompleteManagedSignatureRequest;
      readonly custody?: "local" | "namera-managed";
    }) {
      const { actor } = input;
      const managed = input.custody === "namera-managed";
      const operation = yield* repository.core.signatureOperation.findByIdForActor(
        input.request.operationId,
        actor.organizationId,
        actor.actorId,
      );
      if (
        operation === undefined ||
        (operation.data.managedSignerBinding !== undefined) !== managed ||
        (managed && operation.status === "succeeded") ||
        operation.status === "failed" ||
        (operation.status === "reserved" &&
          DateTime.toEpochMillis(operation.reservationExpiresAt) <=
            DateTime.toEpochMillis(yield* DateTime.now))
      )
        return yield* new SignatureError({ code: "SIGNATURE_UNAVAILABLE" });
      const request: PrepareSignatureRequest = {
        ...operation.data,
        namespace: "eip155",
        walletId: operation.walletId,
        sessionKeyId: operation.sessionKeyId,
      };
      const scope = { ...request, actor, custody: input.custody ?? "local" };
      const selected = yield* authority.load(scope);
      if (
        selected.grant.id !== operation.sessionKeyGrantId ||
        selected.sessionKey.policyHash !== operation.policyHash ||
        (managed &&
          (sessionSignerBinding(selected.signer) !== operation.data.managedSignerBinding ||
            selected.installation.id !== operation.data.installationId))
      )
        return yield* new SignatureError({ code: "SIGNATURE_UNAVAILABLE" });
      yield* authority.evaluate(selected, request);
      const leaseToken = generateUniqueId();
      const rawSignature = yield* Effect.gen(function* () {
        if (!managed) {
          if (!("signature" in input.request))
            return yield* new SignatureError({ code: "SIGNATURE_UNAVAILABLE" });
          return input.request.signature;
        }
        const now = yield* DateTime.now;
        const claimed = yield* repository.core.signatureOperation.claimForSigning({
          id: operation.id,
          organizationId: actor.organizationId,
          actorId: actor.actorId,
          leaseToken,
          now,
          leaseExpiresAt: DateTime.addDuration(now, Duration.minutes(2)),
        });
        if (!claimed) return yield* new SignatureError({ code: "SIGNATURE_UNAVAILABLE" });
        const signer = yield* loadSigner(selected.signer).pipe(
          Effect.mapError(() => new SignatureError({ code: "SIGNING_FAILED" })),
        );
        const typedData = yield* evm.sessionSignatures
          .prepare({ ...request, account: selected.account, session: selected.installation.data })
          .pipe(Effect.mapError(() => new SignatureError({ code: "SIGNING_FAILED" })));
        return yield* Effect.tryPromise({
          try: () => signer.signTypedData(typedData),
          catch: () => new SignatureError({ code: "SIGNING_FAILED" }),
        }).pipe(Effect.map(Schema.decodeSync(Hex)));
      });
      const signature = yield* evm.sessionSignatures
        .complete({
          ...request,
          account: selected.account,
          session: selected.installation.data,
          signature: rawSignature,
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

      // Provider verification is outside locks. Recheck grant and policy authority
      // before settlement; revocation cannot commit between admission and charging.
      const settled = yield* transaction.run(
        Effect.gen(function* () {
          yield* repository.core.wallet.findByIdForUpdate(request.walletId, actor.organizationId);
          const current = yield* authority.load({ ...scope, forUpdate: true });
          if (
            current.installation.id !== selected.installation.id ||
            current.grant.id !== operation.sessionKeyGrantId ||
            current.sessionKey.policyHash !== operation.policyHash ||
            (managed &&
              sessionSignerBinding(current.signer) !== operation.data.managedSignerBinding)
          )
            return yield* new SignatureError({ code: "SIGNATURE_UNAVAILABLE" });
          yield* authority.evaluate(current, request);
          return yield* lifecycle.succeed({
            actor,
            operationId: operation.id,
            ...(managed ? { leaseToken } : {}),
          });
        }),
      );
      if (settled)
        yield* Metric.update(
          Metric.withAttributes(signatureResults, {
            namespace: "eip155",
            type: request.type,
            result: "success",
          }),
          1,
        );
      return {
        namespace: "eip155",
        walletId: request.walletId,
        chainId: request.chainId,
        account: operation.data.account,
        type: request.type,
        signature,
      } satisfies CompleteSignatureResponse;
    },
    Effect.trackDuration(Metric.withAttributes(signatureDuration, { stage: "complete" })),
    Effect.catchTag("DatabaseError", Effect.die),
    Effect.catchTag("EvmPolicyError", () => new SignatureError({ code: "SIGNATURE_UNAVAILABLE" })),
    Effect.tapError((error) =>
      Metric.update(
        Metric.withAttributes(signatureResults, { stage: "complete", result: error.code }),
        1,
      ),
    ),
  );
});
