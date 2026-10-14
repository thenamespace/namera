import { Effect } from "effect";

import {
  EvmChainAllowlistPolicy,
  PolicyHandler,
  type EvmPolicyDecision,
  type EvmSignatureContext,
} from "@namera-ai/protocol";

export class EvmChainAllowlistSignaturePolicyHandler extends PolicyHandler<
  EvmChainAllowlistPolicy,
  EvmSignatureContext,
  EvmPolicyDecision
> {
  readonly type = "evm.chain-allowlist";
  readonly policySchema = EvmChainAllowlistPolicy;

  readonly evaluate = Effect.fn("evm.policy.chain-allowlist.evaluate-signature")(
    (policy: EvmChainAllowlistPolicy, context: EvmSignatureContext) =>
      Effect.succeed(
        policy.chainIds.includes(context.chainId)
          ? ({ allowed: true } satisfies EvmPolicyDecision)
          : ({
              allowed: false,
              policyId: policy.id,
              code: "CHAIN_NOT_ALLOWED",
            } satisfies EvmPolicyDecision),
      ),
  );
}
