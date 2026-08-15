import type { Effect } from "effect";

import type { EvmIntentContext, EvmPolicyDecision } from "@namera-ai/protocol";
import type { EvmSessionKeyPolicies } from "@namera-ai/protocol/model";

export type EvaluateEvmPoliciesInput = {
  readonly policies: EvmSessionKeyPolicies;
  readonly context: EvmIntentContext;
};

export interface EvmPolicyService {
  readonly evaluate: (input: EvaluateEvmPoliciesInput) => Effect.Effect<EvmPolicyDecision>;
}
