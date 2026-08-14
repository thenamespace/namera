import { useMemo } from "react";

import type { ListWalletsResponse } from "@namera-ai/protocol/dto";
import { Typography } from "@namera-ai/ui";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";
import { useEventCallback } from "usehooks-ts";

import { DashboardCardContent, DashboardCardRoot } from "@/components/dashboard-card";
import { HeadingGroup } from "@/components/heading-group";

import type { CreateSessionKeyFormInput, CreateSessionKeyFormValues } from "../types";
import { TimeWindowPolicyCard } from "./evm/time-window";
import { PolicyDialog } from "./policy-dialog";

type SessionKeyPolicyInput = CreateSessionKeyFormInput["policies"][number];
type PolicyNamespace = "eip155";
const emptyPolicies: ReadonlyArray<SessionKeyPolicyInput> = [];

type PolicySectionProps = {
  form: UseFormReturn<CreateSessionKeyFormInput, unknown, CreateSessionKeyFormValues>;
  wallets: ListWalletsResponse;
};

export function PolicySection({ form, wallets }: PolicySectionProps) {
  const walletId = useWatch({ control: form.control, name: "walletId" });
  const watchedPolicies = useWatch({ control: form.control, name: "policies" });
  const policies = watchedPolicies ?? emptyPolicies;
  const wallet = wallets.find((candidate) => candidate.id === walletId);
  const namespace = wallet?.namespace as PolicyNamespace | undefined;
  const existingPolicyTypes = useMemo(() => policies.map((policy) => policy.type), [policies]);
  const handleAdd = useEventCallback((policy: SessionKeyPolicyInput) => {
    form.setValue("policies", [...policies, policy], {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  });
  const handleRemove = useEventCallback((index: number) => {
    form.setValue(
      "policies",
      policies.filter((_, policyIndex) => policyIndex !== index),
      { shouldDirty: true, shouldTouch: true, shouldValidate: true },
    );
  });
  const handleChange = useEventCallback((index: number, policy: SessionKeyPolicyInput) => {
    form.setValue(
      "policies",
      policies.map((currentPolicy, policyIndex) =>
        policyIndex === index ? policy : currentPolicy,
      ),
      { shouldDirty: true, shouldTouch: true, shouldValidate: true },
    );
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
          {policies.map((policy, index) => (
            <TimeWindowPolicyCard
              index={index}
              key={policy.type}
              policy={policy}
              onChange={handleChange}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}
    </section>
  );
}
