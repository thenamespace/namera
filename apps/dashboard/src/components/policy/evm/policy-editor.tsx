import { ChainAllowlistPolicyEditor } from "./chain-allowlist/editor";
import { evmPolicyDefinitions } from "./data";
import { GasBudgetPolicyEditor } from "./gas-budget/editor";
import { NativeSpendLimitPolicyEditor } from "./native-spend-limit/editor";
import { OffchainPermissionEditor } from "./offchain-permission-editor";
import { SignaturePolicyEditor } from "./signature/editor";
import { TimeWindowPolicyEditor } from "./time-window/editor";
import type { EvmPolicyEditorProps, EvmPolicyType } from "./types";

type PolicyEditorProps = EvmPolicyEditorProps & {
  type: EvmPolicyType;
};

export function EvmPolicyEditor({ type, formId, initialValue, onSave }: PolicyEditorProps) {
  switch (type) {
    case "evm.contract-access":
    case "evm.functions-on-contract":
    case "evm.functions-on-all-contracts":
    case "evm.account-functions":
    case "evm.erc20-token-transfer":
      return (
        <OffchainPermissionEditor
          formId={formId}
          onSave={onSave}
          initialValue={initialValue ?? evmPolicyDefinitions[type].initial}
        />
      );
    case "evm.chain-allowlist":
      return (
        <ChainAllowlistPolicyEditor
          formId={formId}
          onSave={onSave}
          {...(initialValue?.type === "evm.chain-allowlist" ? { initialValue } : {})}
        />
      );
    case "evm.gas-budget":
      return (
        <GasBudgetPolicyEditor
          formId={formId}
          onSave={onSave}
          {...(initialValue?.type === "evm.gas-budget" ? { initialValue } : {})}
        />
      );
    case "evm.time-window":
      return (
        <TimeWindowPolicyEditor
          formId={formId}
          onSave={onSave}
          {...(initialValue?.type === "evm.time-window" ? { initialValue } : {})}
        />
      );
    case "evm.native-spend-limit":
      return (
        <NativeSpendLimitPolicyEditor
          formId={formId}
          onSave={onSave}
          {...(initialValue?.type === "evm.native-spend-limit" ? { initialValue } : {})}
        />
      );
    case "evm.signature":
      return (
        <SignaturePolicyEditor
          formId={formId}
          onSave={onSave}
          {...(initialValue?.type === "evm.signature" ? { initialValue } : {})}
        />
      );
  }
}
