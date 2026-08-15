import { DateTime, Effect, Metric } from "effect";

import { Repository } from "@namera-ai/database";
import { Evm } from "@namera-ai/evm";
import { SignatureError } from "@namera-ai/protocol";
import type { ApiKeyActorData, SignRequest, SignResponse } from "@namera-ai/protocol/dto";
import type { EvmSessionKey, SessionKeyGrant } from "@namera-ai/protocol/model";
import {
  signatureDuration,
  signaturePolicyDecisions,
  signatureResults,
} from "@namera-ai/telemetry";

import { Audit } from "#/audit/layer";
import { makeLoadEvmAccount } from "#/wallet/account";

type GrantedSessionKey = {
  readonly grant: SessionKeyGrant;
  readonly sessionKey: EvmSessionKey;
};

export interface SignatureApplication {
  readonly sign: (input: {
    readonly actor: ApiKeyActorData;
    readonly request: SignRequest;
  }) => Effect.Effect<SignResponse, SignatureError>;
}

export const makeSignatureApplication = Effect.gen(function* () {
  const audit = yield* Audit;
  const evm = yield* Evm;
  const repository = yield* Repository;
  const loadEvmAccount = yield* makeLoadEvmAccount;

  const sign = Effect.fn("application.signature.sign")(
    function* (input: { readonly actor: ApiKeyActorData; readonly request: SignRequest }) {
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

      let selected: GrantedSessionKey | undefined;
      let lastPolicyCode: string | undefined;
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
          lastPolicyCode = decision.code;
          continue;
        }
        selected = candidate;
        break;
      }
      if (selected === undefined) {
        yield* Metric.update(
          Metric.withAttributes(signatureResults, {
            namespace: "eip155",
            type: input.request.type,
            result: "policy_denied",
          }),
          1,
        );
        return yield* new SignatureError({ code: "POLICY_DENIED", policyCode: lastPolicyCode });
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
      yield* audit.organization({
        organizationId: input.actor.organizationId,
        actorId: input.actor.actorId,
        event: "signature.created",
        resourceType: "wallet",
        resourceId: wallet.wallet.id,
        data: {
          version: 1,
          namespace: "eip155",
          chainId: input.request.chainId,
          type: input.request.type,
          sessionKeyGrantId: selected.grant.id,
        },
      });
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
