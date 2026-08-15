import type {
  EvmExecutionReceipt,
  EvmIntentContext,
  EvmNativeSpendLimitPolicy,
  EvmNativeSpendLimitPolicyReservation,
  EvmNativeSpendLimitPolicyState,
  EvmPolicyDecision,
  EvmPolicyError,
  PolicyHandler,
} from "@namera-ai/protocol";
import type { EvmSessionKeyPolicy } from "@namera-ai/protocol/model";

import { EvmNativeSpendLimitPolicyHandler } from "./policies/native-spend-limit.js";
import { EvmTimeWindowPolicyHandler } from "./policies/time-window.js";

type EvmExecutionPolicy = Exclude<EvmSessionKeyPolicy, { readonly type: "evm.signature" }>;

type EvmPolicyRegistry = {
  readonly [Type in EvmExecutionPolicy["type"]]: PolicyHandler<
    Extract<EvmExecutionPolicy, { readonly type: Type }>,
    EvmIntentContext,
    EvmPolicyDecision,
    Extract<EvmExecutionPolicy, { readonly type: Type }> extends EvmNativeSpendLimitPolicy
      ? EvmNativeSpendLimitPolicyState
      : never,
    Extract<EvmExecutionPolicy, { readonly type: Type }> extends EvmNativeSpendLimitPolicy
      ? EvmNativeSpendLimitPolicyReservation
      : never,
    Extract<EvmExecutionPolicy, { readonly type: Type }> extends EvmNativeSpendLimitPolicy
      ? Extract<EvmExecutionReceipt, { readonly success: true }>
      : never,
    Extract<EvmExecutionPolicy, { readonly type: Type }> extends EvmNativeSpendLimitPolicy
      ? EvmPolicyError
      : never
  >;
};

export const evmPolicyRegistry = {
  "evm.native-spend-limit": new EvmNativeSpendLimitPolicyHandler(),
  "evm.time-window": new EvmTimeWindowPolicyHandler(),
} satisfies EvmPolicyRegistry;
