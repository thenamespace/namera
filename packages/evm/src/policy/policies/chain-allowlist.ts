import { Effect } from "effect";

import {
  EvmChainAllowlistPolicy,
  PolicyHandler,
  type EvmIntentContext,
  type EvmPolicyDecision,
  type EvmSignatureContext,
} from "@namera-ai/protocol";

const evaluateChainAllowlist = (
  policy: EvmChainAllowlistPolicy,
  chainId: EvmIntentContext["chainId"],
): EvmPolicyDecision =>
  policy.chainIds.includes(chainId)
    ? { allowed: true }
    : { allowed: false, policyId: policy.id, code: "CHAIN_NOT_ALLOWED" };

export class EvmChainAllowlistPolicyHandler extends PolicyHandler<
  EvmChainAllowlistPolicy,
  EvmIntentContext,
  EvmPolicyDecision
> {
  readonly type = "evm.chain-allowlist";
  readonly policySchema = EvmChainAllowlistPolicy;

  readonly evaluate = Effect.fn("evm.policy.chain-allowlist.evaluate")(
    (policy: EvmChainAllowlistPolicy, context: EvmIntentContext) =>
      Effect.succeed(evaluateChainAllowlist(policy, context.chainId)),
  );
}

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
