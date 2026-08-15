import { Effect } from "effect";

import {
  EvmSignaturePolicy,
  PolicyHandler,
  type EvmPolicyDecision,
  type EvmSignatureContext,
} from "@namera-ai/protocol";

export class EvmSignaturePolicyHandler extends PolicyHandler<
  EvmSignaturePolicy,
  EvmSignatureContext,
  EvmPolicyDecision
> {
  readonly type = "evm.signature";
  readonly policySchema = EvmSignaturePolicy;

  readonly evaluate = Effect.fn("evm.policy.signature.evaluate")(
    (policy: EvmSignaturePolicy, context: EvmSignatureContext) =>
      Effect.succeed(
        policy.allowedTypes.includes(context.type)
          ? ({ allowed: true } satisfies EvmPolicyDecision)
          : ({
              allowed: false,
              policyId: policy.id,
              code: "SIGNATURE_TYPE_NOT_ALLOWED",
            } satisfies EvmPolicyDecision),
      ),
  );
}
