import { Effect, Metric } from "effect";

import { Evm } from "@namera-ai/evm";
import { SignatureError } from "@namera-ai/protocol";
import type {
  GrantedActorData,
  VerifySignatureRequest,
  VerifySignatureResponse,
} from "@namera-ai/protocol/dto";
import { signatureVerificationDuration, signatureVerificationResults } from "@namera-ai/telemetry";

import { hasActiveWalletGrant, makeLoadSignatureAccount } from "./account.js";

export const makeVerifySignature = Effect.gen(function* () {
  const evm = yield* Evm;
  const loadSignatureAccount = yield* makeLoadSignatureAccount;

  return Effect.fn("application.signature.verify")(
    function* (input: {
      readonly actor: GrantedActorData;
      readonly request: VerifySignatureRequest;
    }) {
      const { wallet, account } = yield* loadSignatureAccount({
        organizationId: input.actor.organizationId,
        request: input.request,
      }).pipe(
        Effect.tapError(() =>
          Metric.update(
            Metric.withAttributes(signatureVerificationResults, {
              namespace: "eip155",
              type: input.request.type,
              result: "unavailable",
            }),
            1,
          ),
        ),
      );
      if (!hasActiveWalletGrant(input.actor, input.request.walletId)) {
        yield* Metric.update(
          Metric.withAttributes(signatureVerificationResults, {
            namespace: "eip155",
            type: input.request.type,
            result: "no_authorized_session_key",
          }),
          1,
        );
        return yield* new SignatureError({ code: "NO_AUTHORIZED_SESSION_KEY" });
      }

      const valid = yield* evm
        .verifySignature({
          account,
          chainId: input.request.chainId,
          ...(input.request.type === "message"
            ? {
                type: "message" as const,
                message: input.request.message,
                signature: input.request.signature,
              }
            : {
                type: "typed-data" as const,
                typedData: input.request.typedData,
                signature: input.request.signature,
              }),
        })
        .pipe(
          Effect.tapError(() =>
            Metric.update(
              Metric.withAttributes(signatureVerificationResults, {
                namespace: "eip155",
                type: input.request.type,
                result: "failed",
              }),
              1,
            ),
          ),
          Effect.mapError(() => new SignatureError({ code: "VERIFICATION_FAILED" })),
        );
      yield* Metric.update(
        Metric.withAttributes(signatureVerificationResults, {
          namespace: "eip155",
          type: input.request.type,
          result: valid ? "valid" : "invalid",
        }),
        1,
      );

      const response = {
        namespace: "eip155" as const,
        walletId: wallet.wallet.id,
        chainId: input.request.chainId,
        account: wallet.wallet.data.address,
        valid,
      };
      return input.request.type === "message"
        ? ({ ...response, type: "message" } satisfies VerifySignatureResponse)
        : ({ ...response, type: "typed-data" } satisfies VerifySignatureResponse);
    },
    Effect.trackDuration(signatureVerificationDuration),
    Effect.catchTag("DatabaseError", Effect.die),
  );
});
