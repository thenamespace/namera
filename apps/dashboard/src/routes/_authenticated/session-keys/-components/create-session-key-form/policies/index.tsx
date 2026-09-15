// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { useState } from "react";

import type { ListWalletsResponse } from "@namera-ai/protocol/dto";
import { FieldError } from "@namera-ai/ui";
import { useFieldArray, useWatch, type UseFormReturn } from "react-hook-form";

import { HeadingGroup } from "@/components/heading-group";
import { EvmPolicySummary, type SignaturePolicyInput } from "@/components/policy/evm";
import { OnchainPermissionSummary } from "@/components/policy/evm/onchain/summary";

import type { CreateSessionKeyFormInput, CreateSessionKeyFormValues } from "../types";
import { SessionPolicyCard } from "./card";
import { policyChoiceFor } from "./catalog";
import { AddPolicyButton, SessionPolicyDialog, type PolicyEdit } from "./dialog";
import { signatureConfiguration } from "./signature-configuration";

export function PolicySection({
  form,
  wallets,
}: {
  form: UseFormReturn<CreateSessionKeyFormInput, unknown, CreateSessionKeyFormValues>;
  wallets: ListWalletsResponse;
}) {
  const apiFields = useFieldArray({ control: form.control, name: "policies" });
  const permissionFields = useFieldArray({ control: form.control, name: "onchain.permissions" });
  const policies = useWatch({ control: form.control, name: "policies" }) ?? [];
  const onchain = useWatch({ control: form.control, name: "onchain" });
  const walletId = useWatch({ control: form.control, name: "walletId" });
  const [dialog, setDialog] = useState<{ edit?: PolicyEdit } | null>(null);
  const permissions = onchain?.permissions ?? [];
  const signature = policies.find((policy) => policy.type === "evm.signature");
  const signatureChoice = policyChoiceFor("signature");
  const errors = form.formState.errors.onchain;
  const saveSignature = (policy?: SignaturePolicyInput) => {
    const configuration = signatureConfiguration(policy);
    apiFields.replace(configuration.policies);
    form.setValue("onchain.allowSignatures", configuration.allowSignatures, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  return (
    <section className="grid gap-3">
      <div className="mb-1 flex items-start justify-between gap-4">
        <HeadingGroup>
          <HeadingGroup.Title>Policies</HeadingGroup.Title>
          <HeadingGroup.Description>
            Choose what this key can do, then add any limits.
          </HeadingGroup.Description>
        </HeadingGroup>
        <AddPolicyButton
          disabled={!wallets.some((wallet) => wallet.id === walletId)}
          onPress={() => setDialog({})}
        />
      </div>
      {permissionFields.fields.map((field, index) => {
        const permission = permissions[index];
        if (!permission) return null;
        const definition = policyChoiceFor(permission.type);
        return (
          <SessionPolicyCard
            key={field.id}
            name={definition.name}
            icon={definition.icon}
            enforcement="Onchain"
            onEdit={() => setDialog({ edit: { kind: "permission", policy: permission, index } })}
            onRemove={() => permissionFields.remove(index)}
          >
            <OnchainPermissionSummary permission={permission} />
          </SessionPolicyCard>
        );
      })}
      {signature ? (
        <SessionPolicyCard
          name={signatureChoice.name}
          icon={signatureChoice.icon}
          enforcement="Namera rules + onchain authority"
          onEdit={() => setDialog({ edit: { kind: "signature", policy: signature } })}
          onRemove={() => saveSignature()}
        >
          <EvmPolicySummary policy={signature} />
        </SessionPolicyCard>
      ) : null}
      <FieldError
        errors={[
          errors?.permissions,
          errors?.permissions?.root,
          errors?.allowSignatures,
          form.formState.errors.policies,
        ]}
      />
      {dialog ? (
        <SessionPolicyDialog
          open
          edit={dialog.edit}
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          permissions={permissions}
          hasSignatures={signature !== undefined}
          onSaveSignature={saveSignature}
          onSavePermission={(permission, index) =>
            index === undefined
              ? permissionFields.append(permission)
              : permissionFields.update(index, permission)
          }
        />
      ) : null}
    </section>
  );
}
