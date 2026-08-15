import { DateTime, Effect } from "effect";

import {
  EvmTimeWindowPolicy,
  PolicyHandler,
  type EvmIntentContext,
  type EvmPolicyDecision,
} from "@namera-ai/protocol";

export const evaluateTimeWindow = (
  policy: EvmTimeWindowPolicy,
  timestamp: DateTime.Utc,
): EvmPolicyDecision => {
  const epochMilliseconds = DateTime.toEpochMillis(timestamp);

  if (policy.startsAt !== null && epochMilliseconds < DateTime.toEpochMillis(policy.startsAt)) {
    return { allowed: false, policyId: policy.id, code: "TIME_WINDOW_NOT_STARTED" };
  }

  if (epochMilliseconds >= DateTime.toEpochMillis(policy.expiresAt)) {
    return { allowed: false, policyId: policy.id, code: "TIME_WINDOW_EXPIRED" };
  }

  return { allowed: true };
};

export class EvmTimeWindowPolicyHandler extends PolicyHandler<
  EvmTimeWindowPolicy,
  EvmIntentContext,
  EvmPolicyDecision
> {
  readonly type = "evm.time-window";
  readonly policySchema = EvmTimeWindowPolicy;

  readonly evaluate = Effect.fn("evm.policy.time-window.evaluate")(
    (policy: EvmTimeWindowPolicy, context: EvmIntentContext): Effect.Effect<EvmPolicyDecision> => {
      return Effect.succeed(evaluateTimeWindow(policy, context.block.timestamp));
    },
  );
}
