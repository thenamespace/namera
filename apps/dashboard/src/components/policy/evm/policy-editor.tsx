import { NativeSpendLimitPolicyEditor } from "./native-spend-limit-editor";
import { SignaturePolicyEditor } from "./signature-editor";
import { TimeWindowPolicyEditor } from "./time-window-editor";
import type { EvmPolicyEditorProps, EvmPolicyType } from "./types";

type PolicyEditorProps = EvmPolicyEditorProps & {
  type: EvmPolicyType;
};

export function EvmPolicyEditor({ type, formId, initialValue, onSave }: PolicyEditorProps) {
  switch (type) {
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
