// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useId, useState } from "react";

import { Button, Modal, Typography } from "@namera-ai/ui";
import { Add01Icon, HugeiconsIcon } from "@namera-ai/ui/icons";

import type { SignaturePolicyInput } from "@/components/policy/evm";
import type { OnchainPermissionInput } from "@/components/policy/evm/onchain/catalog";
import { OnchainPermissionEditor } from "@/components/policy/evm/onchain/editor";
import { SignaturePolicyEditor } from "@/components/policy/evm/signature/editor";

import {
  permissionConflict,
  policyChoiceFor,
  policyUnavailableReason,
  type PolicyChoice,
} from "./catalog";
import { ContractAccessEditor } from "./contract-access/editor";
import { NativeBudgetEditor } from "./native-budget/editor";
import { PolicyPicker } from "./picker";

export type PolicyEdit =
  | { kind: "signature"; policy: SignaturePolicyInput }
  | { kind: "permission"; policy: OnchainPermissionInput; index: number };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  edit?: PolicyEdit | undefined;
  permissions: ReadonlyArray<OnchainPermissionInput>;
  hasSignatures: boolean;
  onSaveSignature: (policy: SignaturePolicyInput) => void;
  onSavePermission: (policy: OnchainPermissionInput, index?: number) => void;
};

export function SessionPolicyDialog(props: Props) {
  const formId = useId();
  const { edit } = props;
  const [choice, setChoice] = useState<PolicyChoice | undefined>(() =>
    edit ? policyChoiceFor(edit.kind === "signature" ? "signature" : edit.policy.type) : undefined,
  );
  const close = () => props.onOpenChange(false);
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
    <Modal isOpen={props.open} onOpenChange={props.onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container size="lg">
          <Modal.Dialog className="max-w-2xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{choice?.name ?? "Add a policy"}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="grid max-h-[60vh] min-h-0 gap-4 overflow-y-auto">
              {!choice ? (
                <PolicyPicker
                  unavailable={(entry) =>
                    policyUnavailableReason(entry, props.permissions, props.hasSignatures)
                  }
                  onSelect={setChoice}
                />
              ) : choice.id === "signature" ? (
                <>
                  <Typography.Paragraph size="sm" color="muted">
                    One policy enables signing and sets the rules for MCP, CLI and API requests.
                    Your passkey approval also enables onchain signature authority.
                  </Typography.Paragraph>
                  <SignaturePolicyEditor
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
                  key={choice.id}
                  type={choice.id}
                  formId={formId}
                  hideSubmit
                  validatePermission={validatePermission}
                  {...(edit?.kind === "permission" ? { initialValue: edit.policy } : {})}
                  onSave={savePermission}
                />
              )}
            </Modal.Body>
            {choice ? (
              <Modal.Footer className="flex-wrap gap-2">
                <span className="mr-auto self-center text-xs text-muted">
                  {choice.id === "signature"
                    ? "Namera rules + onchain authority"
                    : "Enforced onchain"}
                </span>
                <Button
                  type="button"
                  variant="tertiary"
                  onPress={() => (edit ? close() : setChoice(undefined))}
                >
                  {edit ? "Cancel" : "Back"}
                </Button>
                <Button form={formId} type="submit">
                  {edit ? "Save policy" : "Add policy"}
                </Button>
              </Modal.Footer>
            ) : null}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
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
