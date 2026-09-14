// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useId, useState } from "react";

import { Button, Modal, Typography } from "@namera-ai/ui";
import { Add01Icon, HugeiconsIcon } from "@namera-ai/ui/icons";

import {
  EvmPolicyEditor,
  type EvmPolicyInput,
  type EvmPolicyType,
  type TimeWindowPolicyInput,
} from "@/components/policy/evm";
import {
  onchainPermissionCatalog,
  type OnchainPermissionInput,
} from "@/components/policy/evm/onchain/catalog";
import { OnchainPermissionEditor } from "@/components/policy/evm/onchain/editor";

import {
  isOnchainChoiceUnavailable,
  permissionConflict,
  policyDescription,
  sessionPolicyCatalog,
  type Enforcement,
  type PolicyChoice,
} from "./catalog";
import { PolicyPicker } from "./picker";
import { toSharedPermission, toOffchainPermission } from "./shared-permission";

export type PolicyEdit =
  | { enforcement: "offchain"; policy: EvmPolicyInput; index: number }
  | { enforcement: "onchain"; policy: OnchainPermissionInput; index: number }
  | { enforcement: "onchain"; policy: { type: "signature" }; index?: never }
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
  onRemoveEdit: (edit: PolicyEdit) => void;
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
      props.permissions
        .filter((_, index) => edit?.enforcement !== "onchain" || edit.index !== index)
        .map((permission) => permission.type),
      props.allowSignatures &&
        !(edit?.enforcement === "onchain" && edit.policy.type === "signature"),
    );
  const apiUnavailable = (entry: PolicyChoice) =>
    !entry.api ||
    props.apiTypes.some(
      (type, index) =>
        type === entry.api && !(edit?.enforcement === "offchain" && edit.index === index),
    );
  const close = () => props.onOpenChange(false);
  const select = (entry: PolicyChoice) => {
    setChoice(entry);
    setEnforcement(onchainUnavailable(entry) ? "offchain" : "onchain");
  };
  const finish = () => {
    if (edit && edit.enforcement !== enforcement) props.onRemoveEdit(edit);
    close();
  };
  const saveApi = (policy: EvmPolicyInput) => {
    props.onSaveApi(policy, edit?.enforcement === "offchain" ? edit.index : undefined);
    finish();
  };
  const savePermission = (policy: OnchainPermissionInput) => {
    props.onSavePermission(policy, edit?.enforcement === "onchain" ? edit.index : undefined);
    finish();
  };

  const permissionType =
    choice?.onchain && choice.onchain !== "signature" && choice.onchain !== "time-window"
      ? choice.onchain
      : undefined;
  const shared = permissionType
    ? toOffchainPermission(onchainPermissionCatalog[permissionType].initial) !== undefined
    : false;
  const initialPermission =
    edit?.enforcement === "offchain"
      ? toSharedPermission(edit.policy)
      : edit?.policy.type !== "evm.time-window" && edit?.policy.type !== "signature"
        ? edit?.policy
        : undefined;
  const activeFormId =
    shared || choice?.onchain === "time-window" ? formId : `${formId}-${enforcement}`;
  const validatePermission = (permission: OnchainPermissionInput) =>
    enforcement === "onchain"
      ? permissionConflict(
          permission,
          props.permissions.filter(
            (_, index) => edit?.enforcement !== "onchain" || edit.index !== index,
          ),
        )
      : undefined;

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
                  unavailable={(entry) => onchainUnavailable(entry) && apiUnavailable(entry)}
                  onSelect={select}
                />
              ) : (
                <>
                  {shared && permissionType ? (
                    <OnchainPermissionEditor
                      key={choice.id}
                      type={permissionType}
                      formId={formId}
                      hideSubmit
                      description={policyDescription(choice, enforcement)}
                      {...(initialPermission ? { initialValue: initialPermission } : {})}
                      validatePermission={validatePermission}
                      onSave={(permission) => {
                        if (enforcement === "onchain") savePermission(permission);
                        else {
                          const policy = toOffchainPermission(permission);
                          if (policy) saveApi(policy);
                        }
                      }}
                    />
                  ) : choice.onchain === "time-window" ? (
                    <EvmPolicyEditor
                      key={choice.id}
                      type="evm.time-window"
                      formId={formId}
                      initialValue={
                        edit?.policy.type === "evm.time-window" ? edit.policy : props.lifetime
                      }
                      onSave={(policy) => {
                        if (policy.type !== "evm.time-window") return;
                        if (enforcement === "offchain") saveApi(policy);
                        else {
                          props.onSaveLifetime(policy);
                          finish();
                        }
                      }}
                    />
                  ) : (
                    <>
                      {choice.api ? (
                        <div hidden={enforcement !== "offchain"}>
                          <EvmPolicyEditor
                            key={`${choice.id}-api`}
                            type={choice.api}
                            formId={`${formId}-offchain`}
                            {...(edit?.enforcement === "offchain"
                              ? { initialValue: edit.policy }
                              : {})}
                            onSave={saveApi}
                          />
                        </div>
                      ) : null}
                      {permissionType ? (
                        <div hidden={enforcement !== "onchain"}>
                          <OnchainPermissionEditor
                            key={permissionType}
                            type={permissionType}
                            formId={`${formId}-onchain`}
                            hideSubmit
                            validatePermission={validatePermission}
                            {...(initialPermission ? { initialValue: initialPermission } : {})}
                            onSave={savePermission}
                          />
                        </div>
                      ) : choice.onchain === "signature" && enforcement === "onchain" ? (
                        <Typography.Paragraph size="sm" color="muted">
                          Allow messages and typed-data signatures.
                        </Typography.Paragraph>
                      ) : null}
                    </>
                  )}
                </>
              )}
            </Modal.Body>
            {choice ? (
              <Modal.Footer className="flex-wrap gap-2">
                <fieldset
                  aria-label="Policy enforcement"
                  className="bg-default mr-auto flex self-center rounded-lg p-1"
                >
                  {(["onchain", "offchain"] as const).map((variant) => (
                    <Button
                      key={variant}
                      type="button"
                      size="sm"
                      variant={enforcement === variant ? "secondary" : "ghost"}
                      aria-pressed={enforcement === variant}
                      isDisabled={
                        variant === "onchain" ? onchainUnavailable(choice) : apiUnavailable(choice)
                      }
                      onPress={() => setEnforcement(variant)}
                    >
                      {variant === "onchain" ? "Onchain" : "Offchain"}
                    </Button>
                  ))}
                </fieldset>
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
                      finish();
                    }}
                  >
                    Allow signatures
                  </Button>
                ) : (
                  <Button form={activeFormId} type="submit">
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
