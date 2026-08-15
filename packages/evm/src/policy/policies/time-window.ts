import { DateTime, Effect } from "effect";

import {
  EvmTimeWindowPolicy,
  PolicyHandler,
  type EvmIntentContext,
  type EvmPolicyDecision,
} from "@namera-ai/protocol";

export class EvmTimeWindowPolicyHandler extends PolicyHandler<
  EvmTimeWindowPolicy,
  EvmIntentContext,
  EvmPolicyDecision
> {
  readonly type = "evm.time-window";
  readonly policySchema = EvmTimeWindowPolicy;

  readonly evaluate = Effect.fn("evm.policy.time-window.evaluate")(
    (policy: EvmTimeWindowPolicy, context: EvmIntentContext): Effect.Effect<EvmPolicyDecision> => {
      const timestamp = DateTime.toEpochMillis(context.block.timestamp);

      if (policy.startsAt !== null && timestamp < DateTime.toEpochMillis(policy.startsAt)) {
        return Effect.succeed({
          allowed: false,
          policyId: policy.id,
          code: "TIME_WINDOW_NOT_STARTED",
        } satisfies EvmPolicyDecision);
      }

      if (timestamp >= DateTime.toEpochMillis(policy.expiresAt)) {
        return Effect.succeed({
          allowed: false,
          policyId: policy.id,
          code: "TIME_WINDOW_EXPIRED",
        } satisfies EvmPolicyDecision);
      }

      return Effect.succeed({ allowed: true } satisfies EvmPolicyDecision);
    },
  );
}
