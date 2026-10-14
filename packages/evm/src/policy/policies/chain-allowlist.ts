import { Effect } from "effect";

import {
  EvmChainAllowlistPolicy,
  PolicyHandler,
  type EvmPolicyDecision,
  type EvmSignatureContext,
} from "@namera-ai/protocol";

const evaluateChainAllowlist = (
  policy: EvmChainAllowlistPolicy,
  chainId: EvmSignatureContext["chainId"],
): EvmPolicyDecision =>
  policy.chainIds.includes(chainId)
    ? { allowed: true }
    : { allowed: false, policyId: policy.id, code: "CHAIN_NOT_ALLOWED" };

export class EvmChainAllowlistSignaturePolicyHandler extends PolicyHandler<
  EvmChainAllowlistPolicy,
  EvmSignatureContext,
  EvmPolicyDecision
> {
  readonly type = "evm.chain-allowlist";
  readonly policySchema = EvmChainAllowlistPolicy;

  readonly evaluate = Effect.fn("evm.policy.chain-allowlist.evaluate-signature")(
    (policy: EvmChainAllowlistPolicy, context: EvmSignatureContext) =>
      Effect.succeed(evaluateChainAllowlist(policy, context.chainId)),
  );
}
