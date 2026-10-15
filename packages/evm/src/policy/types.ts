import type { DateTime, Effect } from "effect";

import type {
  EvmPolicyError,
  EvmSignatureContext,
  EvmSignaturePolicyDecision,
} from "@namera-ai/protocol";
import type { EvmSessionKeyPolicies } from "@namera-ai/protocol/model";

export type EvaluateEvmSignaturePoliciesInput = {
  readonly policies: EvmSessionKeyPolicies;
  readonly context: EvmSignatureContext;
};
export interface EvmPolicyService {
  readonly authorizationDeadline: (input: {
    readonly policies: EvmSessionKeyPolicies;
    readonly latest: DateTime.Utc;
  }) => DateTime.Utc;
  readonly evaluateSignature: (
    input: EvaluateEvmSignaturePoliciesInput,
  ) => Effect.Effect<EvmSignaturePolicyDecision, EvmPolicyError>;
}
