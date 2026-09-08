import { DateTime, Effect, Metric } from "effect";

import { Evm } from "@namera-ai/evm";
import { SignatureError } from "@namera-ai/protocol";
import type { PrepareSignatureRequest } from "@namera-ai/protocol/dto";
import { signaturePolicyDecisions } from "@namera-ai/telemetry";

import { makeLoadSessionAuthority } from "#/session-key/authority";

export const makeSignatureAuthority = Effect.gen(function* () {
  const loadSession = yield* makeLoadSessionAuthority;
  const evm = yield* Evm;
  const load = Effect.fnUntraced(function* (input: Parameters<typeof loadSession>[0]) {
    const authority = yield* loadSession(input).pipe(
      Effect.catchTag(
        "SessionKeyOperationError",
        (error) =>
          new SignatureError({
            code:
              error.code === "OPERATION_UNAVAILABLE"
                ? "NO_AUTHORIZED_SESSION_KEY"
                : "SIGNATURE_UNAVAILABLE",
          }),
      ),
    );
    if (authority.installation.data.authorization.allowSignatures !== true)
      return yield* new SignatureError({ code: "SIGNATURE_UNAVAILABLE" });
    return authority;
  });
  const evaluate = Effect.fnUntraced(function* (
    authority: Effect.Success<ReturnType<typeof load>>,
    request: PrepareSignatureRequest,
  ) {
    const decision = yield* evm.policy.evaluateSignature({
      policies: authority.sessionKey.policies,
      context: {
        ...request,
        version: 1,
        account: authority.wallet.wallet.data.address,
        timestamp: yield* DateTime.now,
      },
    });
    yield* Metric.update(
      Metric.withAttributes(signaturePolicyDecisions, {
        namespace: request.namespace,
        type: request.type,
        result: decision.allowed ? "allowed" : "denied",
      }),
      1,
    );
    if (!decision.allowed)
      return yield* new SignatureError({
        code: "POLICY_DENIED",
        ...("policyId" in decision
          ? { policyId: decision.policyId, policyCode: decision.code }
          : {}),
      });
  });
  return { load, evaluate };
});
