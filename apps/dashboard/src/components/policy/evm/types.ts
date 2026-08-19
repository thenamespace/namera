import type { CreateEvmSessionKeyPolicy } from "@namera-ai/protocol/model";

export type EvmPolicyInput = typeof CreateEvmSessionKeyPolicy.Encoded;
export type EvmPolicyType = EvmPolicyInput["type"];
export type ChainAllowlistPolicyInput = Extract<
  EvmPolicyInput,
  { readonly type: "evm.chain-allowlist" }
>;
export type TimeWindowPolicyInput = Extract<EvmPolicyInput, { readonly type: "evm.time-window" }>;
export type NativeSpendLimitPolicyInput = Extract<
  EvmPolicyInput,
  { readonly type: "evm.native-spend-limit" }
>;
export type SignaturePolicyInput = Extract<EvmPolicyInput, { readonly type: "evm.signature" }>;
export type GasBudgetPolicyInput = Extract<EvmPolicyInput, { readonly type: "evm.gas-budget" }>;

export type EvmPolicyEditorProps = {
  formId: string;
  initialValue?: EvmPolicyInput;
  onSave: (policy: EvmPolicyInput) => void;
};
