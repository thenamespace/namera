import { useMemo } from "react";

import type { ListWalletsResponse } from "@namera-ai/protocol/dto";
import { Typography } from "@namera-ai/ui";
import type { UseFormReturn } from "react-hook-form";
import { useFieldArray, useWatch } from "react-hook-form";
import { useEventCallback } from "usehooks-ts";

import { DashboardCardContent, DashboardCardRoot } from "@/components/dashboard-card";
import { HeadingGroup } from "@/components/heading-group";

import type { CreateSessionKeyFormInput, CreateSessionKeyFormValues } from "../types";
import { TimeWindowPolicyCard } from "./evm/time-window";
import { PolicyDialog } from "./policy-dialog";

type SessionKeyPolicyInput = CreateSessionKeyFormInput["policies"][number];
type TimeWindowPolicyInput = Extract<SessionKeyPolicyInput, { readonly type: "evm.time-window" }>;
type PolicyNamespace = "eip155";
const emptyPolicies: ReadonlyArray<SessionKeyPolicyInput> = [];

type PolicySectionProps = {
  form: UseFormReturn<CreateSessionKeyFormInput, unknown, CreateSessionKeyFormValues>;
  wallets: ListWalletsResponse;
};

export function PolicySection({ form, wallets }: PolicySectionProps) {
  const policyFields = useFieldArray({ control: form.control, name: "policies" });
  const walletId = useWatch({ control: form.control, name: "walletId" });
  const watchedPolicies = useWatch({ control: form.control, name: "policies" });
  const policies = watchedPolicies ?? emptyPolicies;
  const wallet = wallets.find((candidate) => candidate.id === walletId);
  const namespace = wallet?.namespace as PolicyNamespace | undefined;
  const existingPolicyTypes = useMemo(() => policies.map((policy) => policy.type), [policies]);
  const handleAdd = useEventCallback((policy: SessionKeyPolicyInput) => {
    policyFields.append(policy, { shouldFocus: false });
  });
  const handleRemove = useEventCallback((index: number) => {
    policyFields.remove(index);
  });
  const handleChange = useEventCallback((index: number, policy: SessionKeyPolicyInput) => {
    policyFields.update(index, policy);
  });

  return (
    <section>
      <div className="mb-4 flex items-start justify-between gap-4">
        <HeadingGroup>
          <HeadingGroup.Title>Policies</HeadingGroup.Title>
          <HeadingGroup.Description>
            Define when and how this session key can be used.
          </HeadingGroup.Description>
        </HeadingGroup>
        <PolicyDialog
          existingPolicyTypes={existingPolicyTypes}
          namespace={namespace}
          onAdd={handleAdd}
        />
      </div>

      {policies.length === 0 ? (
        <DashboardCardRoot>
          <DashboardCardContent className="px-6 py-8 text-center">
            <Typography.Paragraph color="muted" size="sm" className="text-center">
              {wallet
                ? "No policies added. Add at least one policy to continue."
                : "Select an account before adding policies."}
            </Typography.Paragraph>
          </DashboardCardContent>
        </DashboardCardRoot>
      ) : (
        <div className="grid gap-3">
          {policyFields.fields.map((field, index) =>
            policies[index]?.type === "evm.time-window" ? (
              <TimeWindowPolicyCard
                index={index}
                key={field.id}
                policy={policies[index] as TimeWindowPolicyInput}
                onChange={handleChange}
                onRemove={handleRemove}
              />
            ) : null,
          )}
        </div>
      )}
    </section>
  );
}
