// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useId } from "react";

import type { SupportedEvmChainId } from "@namera-ai/protocol/evm";
import { Button, Typography } from "@namera-ai/ui";
import { Add01Icon, HugeiconsIcon } from "@namera-ai/ui/icons";

import type { SignaturePolicyInput } from "@/components/policy/evm";
import type { OnchainPermissionInput } from "@/components/policy/evm/onchain/catalog";
import { OnchainPermissionEditor } from "@/components/policy/evm/onchain/editor";
import type { TokenSpendingSelection } from "@/components/policy/evm/onchain/token-allowance/form";
import { SignaturePolicyEditor } from "@/components/policy/evm/signature/editor";

import {
  permissionConflict,
  policyChoiceFor,
  policyUnavailableReason,
  type PolicyChoice,
} from "./catalog";
import { ContractAccessEditor, type ContractAccessDraft } from "./contract-access/editor";
import { EnforcementPills } from "./enforcement-pills";
import { NativeBudgetEditor } from "./native-budget/editor";
import { PolicyPicker } from "./picker";

export type PolicyEdit =
  | { kind: "signature"; policy: SignaturePolicyInput }
  | { kind: "permission"; policy: OnchainPermissionInput; index: number };

type Props = {
  chainIds: readonly SupportedEvmChainId[];
  signatureChainIds: readonly SupportedEvmChainId[];
  onClose: () => void;
  draft?: PolicyChoice | undefined;
  onAddDraft: (choice: PolicyChoice) => void;
  edit?: PolicyEdit | undefined;
  permissions: ReadonlyArray<OnchainPermissionInput>;
  hasSignatures: boolean;
  onAddSignature: () => void;
  onAddBudget: (type: "gas-limit" | "native-token-transfer") => void;
  onSaveSignature: (policy: SignaturePolicyInput) => void;
  initialContractDraft?: ContractAccessDraft | undefined;
  onSaveContractDraft: (permission: OnchainPermissionInput, draft: ContractAccessDraft) => void;
  initialTokenSelection?: TokenSpendingSelection | undefined;
  onSaveTokenSelection: (selection: TokenSpendingSelection) => void;
  onSavePermission: (policy: OnchainPermissionInput, index?: number) => void;
};

export function SessionPolicyEditor(props: Props) {
  const formId = useId();
  const { edit } = props;
  const choice = edit
    ? policyChoiceFor(edit.kind === "signature" ? "signature" : edit.policy.type)
    : props.draft;
  const close = props.onClose;
  const validatePermission = (permission: OnchainPermissionInput) =>
    permissionConflict(
      permission,
      props.permissions.filter((_, index) => edit?.kind !== "permission" || edit.index !== index),
    );
  const savePermission = (permission: OnchainPermissionInput) => {
    props.onSavePermission(permission, edit?.kind === "permission" ? edit.index : undefined);
    close();
  };

  return (
    <section className="grid gap-6" aria-label={choice?.name ?? "Add a policy"}>
      {!edit && !props.draft ? (
        <Typography.Heading level={2} className="text-base">
          {choice?.name ?? "Add a policy"}
        </Typography.Heading>
      ) : null}
      <div className="grid min-w-0 gap-4">
        {!choice ? (
          <PolicyPicker
            unavailable={(entry) =>
              policyUnavailableReason(entry, props.permissions, props.hasSignatures)
            }
            onSelect={(next) => {
              if (policyUnavailableReason(next, props.permissions, props.hasSignatures)) return;
              if (next.id === "root") {
                savePermission({ type: "root" });
                return;
              }
              if (next.id === "signature") {
                props.onAddSignature();
                return;
              }
              if (next.id === "gas-limit" || next.id === "native-token-transfer") {
                props.onAddBudget(next.id);
                return;
              }
              props.onAddDraft(next);
            }}
          />
        ) : choice.id === "signature" ? (
          <>
            <SignaturePolicyEditor
              chainIds={props.signatureChainIds}
              formId={formId}
              {...(edit?.kind === "signature" ? { initialValue: edit.policy } : {})}
              onSave={(policy) => {
                if (policy.type !== "evm.signature") return;
                props.onSaveSignature(policy);
                close();
              }}
            />
          </>
        ) : choice.id === "contract-access" ? (
          <ContractAccessEditor
            initialDraft={props.initialContractDraft}
            onSaveDraft={props.onSaveContractDraft}
            chainIds={props.chainIds}
            formId={formId}
            initialValue={edit?.kind === "permission" ? edit.policy : undefined}
            validatePermission={validatePermission}
            onSave={savePermission}
          />
        ) : choice.id === "gas-limit" || choice.id === "native-token-transfer" ? (
          <NativeBudgetEditor
            type={choice.id}
            formId={formId}
            initialValue={edit?.kind === "permission" ? edit.policy : undefined}
            validatePermission={validatePermission}
            onSave={savePermission}
          />
        ) : (
          <OnchainPermissionEditor
            initialTokenSelection={props.initialTokenSelection}
            onSaveTokenSelection={props.onSaveTokenSelection}
            chainIds={props.chainIds}
            key={choice.id}
            type={choice.id}
            formId={formId}
            hideSubmit
            validatePermission={validatePermission}
            {...(edit?.kind === "permission" ? { initialValue: edit.policy } : {})}
            onSave={savePermission}
          />
        )}
      </div>
      {choice ? (
        <div className="flex flex-wrap justify-end gap-2 border-t border-separator pt-4">
          <EnforcementPills api={choice.id === "signature"} />
          <Button type="button" variant="tertiary" onPress={close}>
            Cancel
          </Button>
          <Button form={formId} type="submit">
            {edit || props.draft ? "Save policy" : "Add policy"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

export function AddPolicyButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  return (
    <Button type="button" size="sm" variant="tertiary" isDisabled={disabled} onPress={onPress}>
      <HugeiconsIcon icon={Add01Icon} />
      Add policy
    </Button>
  );
}
