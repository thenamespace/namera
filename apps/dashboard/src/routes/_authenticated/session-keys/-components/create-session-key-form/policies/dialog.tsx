// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useId, useState } from "react";

import { Button, Modal } from "@namera-ai/ui";
import { Add01Icon, HugeiconsIcon } from "@namera-ai/ui/icons";

import {
  EvmPolicyEditor,
  type EvmPolicyInput,
  type EvmPolicyType,
  type TimeWindowPolicyInput,
} from "@/components/policy/evm";
import type { OnchainPermissionInput } from "@/components/policy/evm/onchain/catalog";
import { OnchainPermissionEditor } from "@/components/policy/evm/onchain/editor";

import {
  isOnchainChoiceUnavailable,
  permissionConflict,
  sessionPolicyCatalog,
  type Enforcement,
  type PolicyChoice,
} from "./catalog";
import { PolicyPicker } from "./picker";

export type PolicyEdit =
  | { enforcement: "offchain"; policy: EvmPolicyInput; index: number }
  | { enforcement: "onchain"; policy: OnchainPermissionInput; index: number }
  | { enforcement: "onchain"; policy: TimeWindowPolicyInput; index?: never };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  edit?: PolicyEdit | undefined;
  apiTypes: ReadonlyArray<EvmPolicyType>;
  permissions: ReadonlyArray<OnchainPermissionInput>;
  allowSignatures: boolean;
  lifetime: TimeWindowPolicyInput;
  onSaveApi: (policy: EvmPolicyInput, index?: number) => void;
  onSavePermission: (policy: OnchainPermissionInput, index?: number) => void;
  onSaveLifetime: (policy: TimeWindowPolicyInput) => void;
  onEnableSignatures: () => void;
};

export function SessionPolicyDialog(props: Props) {
  const formId = useId();
  const { edit } = props;
  const [choice, setChoice] = useState<PolicyChoice | undefined>(() =>
    edit
      ? sessionPolicyCatalog.find((entry) =>
          edit.enforcement === "offchain"
            ? entry.api === edit.policy.type
            : entry.onchain ===
              (edit.policy.type === "evm.time-window" ? "time-window" : edit.policy.type),
        )
      : undefined,
  );
  const [enforcement, setEnforcement] = useState<Enforcement>(edit?.enforcement ?? "onchain");
  const onchainUnavailable = (entry: PolicyChoice) =>
    !entry.onchain ||
    isOnchainChoiceUnavailable(
      entry.onchain,
      props.permissions.map((permission) => permission.type),
      props.allowSignatures,
    );
  const apiUnavailable = (entry: PolicyChoice) => !entry.api || props.apiTypes.includes(entry.api);
  const close = () => props.onOpenChange(false);
  const select = (entry: PolicyChoice) => {
    setChoice(entry);
  };
  const saveApi = (policy: EvmPolicyInput) => {
    props.onSaveApi(policy, edit?.enforcement === "offchain" ? edit.index : undefined);
    close();
  };
  const savePermission = (policy: OnchainPermissionInput) => {
    props.onSavePermission(policy, edit?.enforcement === "onchain" ? edit.index : undefined);
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
                  enforcement={enforcement}
                  onEnforcementChange={setEnforcement}
                  unavailable={enforcement === "onchain" ? onchainUnavailable : apiUnavailable}
                  onSelect={select}
                />
              ) : (
                <>
                  {enforcement === "offchain" && choice.api ? (
                    <EvmPolicyEditor
                      key={`${choice.id}-api`}
                      type={choice.api}
                      formId={formId}
                      {...(edit?.enforcement === "offchain" ? { initialValue: edit.policy } : {})}
                      onSave={saveApi}
                    />
                  ) : choice.onchain === "time-window" ? (
                    <EvmPolicyEditor
                      key="lifetime"
                      type="evm.time-window"
                      formId={formId}
                      initialValue={props.lifetime}
                      onSave={(policy) => {
                        if (policy.type === "evm.time-window") {
                          props.onSaveLifetime(policy);
                          close();
                        }
                      }}
                    />
                  ) : choice.onchain && choice.onchain !== "signature" ? (
                    <OnchainPermissionEditor
                      key={choice.onchain}
                      type={choice.onchain}
                      formId={formId}
                      hideSubmit
                      validatePermission={(permission) =>
                        permissionConflict(
                          permission,
                          props.permissions.filter(
                            (_, index) => edit?.enforcement !== "onchain" || edit.index !== index,
                          ),
                        )
                      }
                      {...(edit?.enforcement === "onchain" && edit.policy.type !== "evm.time-window"
                        ? { initialValue: edit.policy }
                        : {})}
                      onSave={savePermission}
                    />
                  ) : null}
                </>
              )}
            </Modal.Body>
            {choice ? (
              <Modal.Footer>
                <span className="text-muted bg-default mr-auto self-center rounded-md px-2 py-1 text-xs">
                  {enforcement === "onchain" ? "Onchain" : "Offchain"}
                </span>
                <Button
                  type="button"
                  variant="tertiary"
                  onPress={() => (edit ? close() : setChoice(undefined))}
                >
                  {edit ? "Cancel" : "Back"}
                </Button>
                {enforcement === "onchain" && choice.onchain === "signature" ? (
                  <Button
                    type="button"
                    onPress={() => {
                      props.onEnableSignatures();
                      close();
                    }}
                  >
                    Allow signatures
                  </Button>
                ) : (
                  <Button form={formId} type="submit">
                    {edit || (choice.onchain === "time-window" && enforcement === "onchain")
                      ? "Save policy"
                      : "Add policy"}
                  </Button>
                )}
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
