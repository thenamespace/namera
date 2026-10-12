// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop react-perf/jsx-no-jsx-as-prop
import { useState } from "react";

import type { ListWalletsResponse } from "@namera-ai/protocol/dto";
import { FieldError, Modal } from "@namera-ai/ui";
import { HugeiconsIcon } from "@namera-ai/ui/icons";
import { useFieldArray, useWatch, type UseFormReturn } from "react-hook-form";

import { HeadingGroup } from "@/components/heading-group";
import { EvmPolicySummary, type SignaturePolicyInput } from "@/components/policy/evm";
import { OnchainPolicyCard } from "@/components/policy/evm/onchain/display-card";
import type { TokenSpendingSelection } from "@/components/policy/evm/onchain/token-allowance/form";
import { SessionPolicyCard } from "@/components/policy/evm/session-policy-card";

import type { CreateSessionKeyFormInput, CreateSessionKeyFormValues } from "../types";
import { policyChoiceFor, type PolicyChoice } from "./catalog";
import type { ContractAccessDraft } from "./contract-access/editor";
import { AddPolicyButton, SessionPolicyEditor, type PolicyEdit } from "./editor";
import { toNativeBudgetPermission } from "./native-budget/form";
import { RequiredPolicies } from "./required-policies";
import { signatureConfiguration } from "./signature-configuration";

const signatureChoice = policyChoiceFor("signature");
const signatureLogo = <HugeiconsIcon icon={signatureChoice.icon} />;

export function PolicySection({
  form,
  wallets,
  editing,
  onEditingChange,
  tokenSelections,
  onSaveTokenSelection,
}: {
  form: UseFormReturn<CreateSessionKeyFormInput, unknown, CreateSessionKeyFormValues>;
  wallets: ListWalletsResponse;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  tokenSelections: ReadonlyMap<string, TokenSpendingSelection>;
  onSaveTokenSelection: (selection: TokenSpendingSelection) => void;
}) {
  const apiFields = useFieldArray({ control: form.control, name: "policies" });
  const permissionFields = useFieldArray({ control: form.control, name: "onchain.permissions" });
  const policies = useWatch({ control: form.control, name: "policies" }) ?? [];
  const onchain = useWatch({ control: form.control, name: "onchain" });
  const walletId = useWatch({ control: form.control, name: "walletId" });
  const [pane, setPane] = useState<{
    edit?: PolicyEdit;
    draft?: PolicyChoice;
    required?: "networks" | "lifetime";
  } | null>(null);
  const [contractDrafts, setContractDrafts] = useState<ReadonlyMap<string, ContractAccessDraft>>(
    () => new Map(),
  );
  const close = () => {
    setPane(null);
    onEditingChange(false);
  };
  const editPolicy = (edit: PolicyEdit) => {
    setPane({ edit });
    onEditingChange(true);
  };
  const permissions = onchain?.permissions ?? [];
  const signature = policies.find((policy) => policy.type === "evm.signature");
  const errors = form.formState.errors.onchain;
  const saveSignature = (policy?: SignaturePolicyInput) => {
    const configuration = signatureConfiguration(policy);
    apiFields.replace(configuration.policies);
    form.setValue("onchain.allowSignatures", configuration.allowSignatures, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };
  const policyEditor =
    pane && !pane.required ? (
      <SessionPolicyEditor
        initialContractDraft={
          pane.edit?.kind === "permission"
            ? contractDrafts.get(JSON.stringify(pane.edit.policy))
            : undefined
        }
        onSaveContractDraft={(permission, draft) =>
          setContractDrafts((previous) => new Map(previous).set(JSON.stringify(permission), draft))
        }
        initialTokenSelection={
          pane.edit?.kind === "permission" && pane.edit.policy.type === "erc20-token-transfer"
            ? tokenSelections.get(pane.edit.policy.address.toLowerCase())
            : undefined
        }
        onSaveTokenSelection={onSaveTokenSelection}
        chainIds={onchain.chains}
        edit={pane.edit}
        draft={pane.draft}
        onClose={close}
        onAddDraft={(draft) => {
          setPane({ draft });
          onEditingChange(true);
        }}
        permissions={permissions}
        hasSignatures={signature !== undefined}
        onAddSignature={() => {
          const policy: SignaturePolicyInput = {
            type: "evm.signature",
            version: 1,
            allowedTypes: ["message"],
          };
          saveSignature(policy);
          editPolicy({ kind: "signature", policy });
        }}
        onSaveSignature={saveSignature}
        onAddBudget={(type) => {
          const policy = toNativeBudgetPermission(type, "0");
          const index = permissions.length;
          permissionFields.append(policy, { shouldFocus: false });
          editPolicy({ kind: "permission", policy, index });
        }}
        onSavePermission={(permission, index) =>
          index === undefined
            ? permissionFields.append(permission)
            : permissionFields.update(index, permission)
        }
      />
    ) : null;

  return (
    <section className="grid gap-3">
      <div className="mb-1 flex items-start justify-between gap-4">
        <HeadingGroup>
          <HeadingGroup.Title size="sm">Policies</HeadingGroup.Title>
          <HeadingGroup.Description>
            Choose what this key can do, then add any limits.
          </HeadingGroup.Description>
          {form.formState.isSubmitted &&
          (errors?.permissions || errors?.allowSignatures || form.formState.errors.policies) ? (
            <div>
              <FieldError
                errors={[
                  errors?.permissions,
                  errors?.permissions?.root,
                  errors?.allowSignatures,
                  form.formState.errors.policies,
                ]}
              />
            </div>
          ) : null}
        </HeadingGroup>
        <AddPolicyButton
          disabled={editing || !wallets.some((wallet) => wallet.id === walletId)}
          onPress={() => {
            setPane({});
            onEditingChange(true);
          }}
        />
      </div>
      <div className="grid gap-3" aria-label="Configured policies">
        <RequiredPolicies
          form={form}
          editing={pane?.required}
          disabled={editing}
          onClose={close}
          onEdit={(required) => {
            setPane({ required });
            onEditingChange(true);
          }}
        />
        {permissionFields.fields.map((field, index) => {
          const permission = permissions[index];
          if (!permission) return null;
          return (
            <OnchainPolicyCard
              key={field.id}
              permission={permission}
              chainIds={onchain.chains}
              onEdit={
                permission.type === "root"
                  ? undefined
                  : () => editPolicy({ kind: "permission", policy: permission, index })
              }
              disabled={editing}
              selected={pane?.edit?.kind === "permission" && pane.edit.index === index}
              editor={
                pane?.edit?.kind === "permission" && pane.edit.index === index ? policyEditor : null
              }
              onRemove={() => permissionFields.remove(index)}
            />
          );
        })}
        {signature ? (
          <SessionPolicyCard
            name={signatureChoice.name}
            logo={signatureLogo}
            onEdit={() => editPolicy({ kind: "signature", policy: signature })}
            disabled={editing}
            selected={pane?.edit?.kind === "signature"}
            editor={pane?.edit?.kind === "signature" ? policyEditor : null}
            onRemove={() => saveSignature()}
          >
            <EvmPolicySummary policy={signature} />
          </SessionPolicyCard>
        ) : null}
        {pane?.draft ? (
          <SessionPolicyCard
            name={pane.draft.name}
            logo={<HugeiconsIcon icon={pane.draft.icon} />}
            selected
            editor={policyEditor}
          >
            {pane.draft.description}
          </SessionPolicyCard>
        ) : null}
      </div>
      {pane && !pane.edit && !pane.required && !pane.draft ? (
        <Modal
          isOpen
          onOpenChange={(open) => {
            if (!open) close();
          }}
        >
          <Modal.Backdrop>
            <Modal.Container size="lg">
              <Modal.Dialog className="max-w-2xl" aria-label="Add a policy">
                <Modal.CloseTrigger />
                <Modal.Body className="max-h-[80vh] overflow-y-auto p-4">{policyEditor}</Modal.Body>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      ) : null}
    </section>
  );
}
