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
      Effect.sync(() => {
        if (!policy.allowedTypes.includes(context.type))
          return {
            allowed: false,
            policyId: policy.id,
            code: "SIGNATURE_TYPE_NOT_ALLOWED",
          } satisfies EvmPolicyDecision;

        if (context.type === "typed-data" && policy.typedDataRules !== undefined) {
          const { domain, primaryType } = context.typedData;
          // Match a complete tuple; independent allowlists would authorize unintended
          // combinations of a protocol's contract, domain and message type.
          const permitted = policy.typedDataRules.some(
            (rule) =>
              rule.chainId === context.chainId &&
              `eip155:${domain.chainId}` === rule.chainId &&
              domain.verifyingContract?.toLowerCase() === rule.verifyingContract.toLowerCase() &&
              (rule.name === undefined || rule.name === domain.name) &&
              (rule.version === undefined || rule.version === domain.version) &&
              rule.primaryTypes.includes(primaryType),
          );
          if (!permitted)
            return {
              allowed: false,
              policyId: policy.id,
              code: "TYPED_DATA_NOT_ALLOWED",
            } satisfies EvmPolicyDecision;
        }
        return { allowed: true } satisfies EvmPolicyDecision;
      }),
  );
}
