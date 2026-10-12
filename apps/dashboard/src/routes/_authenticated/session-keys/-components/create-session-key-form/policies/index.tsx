// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop react-perf/jsx-no-jsx-as-prop
import { useState, type ReactNode } from "react";

import type { ListWalletsResponse } from "@namera-ai/protocol/dto";
import { FieldError, Modal, Typography } from "@namera-ai/ui";
import { HugeiconsIcon } from "@namera-ai/ui/icons";
import { useWatch, type UseFormReturn } from "react-hook-form";

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

const signatureChoice = policyChoiceFor("signature");
const signatureLogo = <HugeiconsIcon icon={signatureChoice.icon} />;

export function PolicySection({
  form,
  installationIndex,
  wallets,
  editing,
  onEditingChange,
  tokenSelections,
  onSaveTokenSelection,
  networkSelector,
}: {
  form: UseFormReturn<CreateSessionKeyFormInput, unknown, CreateSessionKeyFormValues>;
  installationIndex: number;
  wallets: ListWalletsResponse;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  tokenSelections: ReadonlyMap<string, TokenSpendingSelection>;
  onSaveTokenSelection: (selection: TokenSpendingSelection) => void;
  networkSelector: ReactNode;
}) {
  const policies = useWatch({ control: form.control, name: "policies" }) ?? [];
  const installations = useWatch({ control: form.control, name: "onchain.installations" });
  const onchain = installations[installationIndex];
  const walletId = useWatch({ control: form.control, name: "walletId" });
  const [pane, setPane] = useState<{
    edit?: PolicyEdit;
    draft?: PolicyChoice;
    required?: "lifetime";
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
  const savePermissions = (next: typeof permissions) =>
    form.setValue(`onchain.installations.${installationIndex}.permissions`, next, {
      shouldDirty: true,
      shouldValidate: true,
    });
  if (!onchain) throw new Error("Missing installation editor scope");
  const sharedSignature = policies.find((policy) => policy.type === "evm.signature");
  const signature = onchain.allowSignatures ? sharedSignature : undefined;
  const [signatureError, setSignatureError] = useState<string>();
  const errors = form.formState.errors.onchain?.installations?.[installationIndex];
  const saveSignature = (policy?: SignaturePolicyInput) => {
    if (
      !policy &&
      sharedSignature?.typedDataRules?.some((rule) => rule.chainId === onchain.chainId)
    ) {
      setSignatureError("Remove this network’s typed-data rules before disabling signatures.");
      return;
    }
    setSignatureError(undefined);
    if (policy) form.setValue("policies", [policy], { shouldDirty: true });
    else if (
      !installations.some((entry, index) => index !== installationIndex && entry.allowSignatures)
    )
      form.setValue("policies", [], { shouldDirty: true });
    form.setValue(`onchain.installations.${installationIndex}.allowSignatures`, Boolean(policy), {
      shouldDirty: true,
      shouldValidate: true,
    });
  };
  const policyEditor =
    pane && !pane.required ? (
      <SessionPolicyEditor
        initialContractDraft={
          pane.edit?.kind === "permission"
            ? contractDrafts.get(`${onchain.chainId}:${JSON.stringify(pane.edit.policy)}`)
            : undefined
        }
        onSaveContractDraft={(permission, draft) =>
          setContractDrafts((previous) =>
            new Map(previous).set(`${onchain.chainId}:${JSON.stringify(permission)}`, draft),
          )
        }
        initialTokenSelection={
          pane.edit?.kind === "permission" && pane.edit.policy.type === "erc20-token-transfer"
            ? tokenSelections.get(`${onchain.chainId}:${pane.edit.policy.address.toLowerCase()}`)
            : undefined
        }
        onSaveTokenSelection={onSaveTokenSelection}
        chainIds={[onchain.chainId]}
        signatureChainIds={installations
          .filter((entry) => entry.allowSignatures || entry.chainId === onchain.chainId)
          .map(({ chainId }) => chainId)}
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
          const policy: SignaturePolicyInput = sharedSignature ?? {
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
          savePermissions([...permissions, policy]);
          editPolicy({ kind: "permission", policy, index });
        }}
        onSavePermission={(permission, index) =>
          index === undefined
            ? savePermissions([...permissions, permission])
            : savePermissions(
                permissions.map((existing, position) =>
                  position === index ? permission : existing,
                ),
              )
        }
      />
    ) : null;

  return (
    <section className="grid gap-3">
      <div className="mb-1 flex items-end gap-3">
        <div className="min-w-0 flex-1">{networkSelector}</div>
        <div className="shrink-0 pb-0.5">
          <AddPolicyButton
            disabled={editing || !wallets.some((wallet) => wallet.id === walletId)}
            onPress={() => {
              setPane({});
              onEditingChange(true);
            }}
          />
        </div>
      </div>
      {form.formState.isSubmitted &&
      (errors?.permissions || errors?.allowSignatures || form.formState.errors.policies) ? (
        <FieldError
          errors={[
            errors?.permissions,
            errors?.permissions?.root,
            errors?.allowSignatures,
            form.formState.errors.policies,
          ]}
        />
      ) : null}
      <div className="grid gap-3" aria-label="Configured policies">
        <RequiredPolicies
          form={form}
          installationIndex={installationIndex}
          editing={pane?.required}
          disabled={editing}
          onClose={close}
          onEdit={(required) => {
            setPane({ required });
            onEditingChange(true);
          }}
        />
        {permissions.map((permission, index) => {
          return (
            <OnchainPolicyCard
              key={"address" in permission ? permission.address.toLowerCase() : permission.type}
              permission={permission}
              chainIds={[onchain.chainId]}
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
              onRemove={() =>
                savePermissions(permissions.filter((_, position) => position !== index))
              }
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
            <Typography.Paragraph size="xs" className="text-muted mt-2">
              Signing rules are shared across enabled networks. Onchain authority is enabled on this
              network.
            </Typography.Paragraph>
          </SessionPolicyCard>
        ) : null}
        {signatureError ? <FieldError>{signatureError}</FieldError> : null}
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
