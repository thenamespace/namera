import type { EvmIntentContext, EvmPolicyDecision, PolicyHandler } from "@namera-ai/protocol";
import type { EvmSessionKeyPolicy } from "@namera-ai/protocol/model";

import { EvmTimeWindowPolicyHandler } from "./time-window.js";

type EvmPolicyRegistry = {
  readonly [Type in EvmSessionKeyPolicy["type"]]: PolicyHandler<
    Extract<EvmSessionKeyPolicy, { readonly type: Type }>,
    EvmIntentContext,
    EvmPolicyDecision
  >;
};

export const evmPolicyRegistry = {
  "evm.time-window": new EvmTimeWindowPolicyHandler(),
} satisfies EvmPolicyRegistry;
