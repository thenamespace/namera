import { useMemo } from "react";

import type { ListWalletsResponse } from "@namera-ai/protocol/dto";
import { Typography } from "@namera-ai/ui";
import type { UseFormReturn } from "react-hook-form";
import { useFieldArray, useWatch } from "react-hook-form";
import { useEventCallback } from "usehooks-ts";

import { DashboardCardContent, DashboardCardRoot } from "@/components/dashboard-card";
import { HeadingGroup } from "@/components/heading-group";
import {
  EvmPolicyCard,
  EvmPolicyDialog,
  type EvmPolicyInput,
  type EvmPolicyType,
} from "@/components/policy/evm";

import type { CreateSessionKeyFormInput, CreateSessionKeyFormValues } from "../types";

type SessionKeyPolicyInput = CreateSessionKeyFormInput["policies"][number];
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
  const existingPolicyTypes = useMemo(() => policies.map((policy) => policy.type), [policies]);
  const handleAdd = useEventCallback((policy: EvmPolicyInput) => {
    policyFields.append(policy, { shouldFocus: false });
  });
  const handleRemove = useEventCallback((index: number) => {
    policyFields.remove(index);
  });
  const handleChange = useEventCallback((index: number, policy: EvmPolicyInput) => {
    policyFields.update(index, policy);
  });

  return (
    <section>
      <div className="mb-4 flex items-start justify-between gap-4">
        <HeadingGroup>
          <HeadingGroup.Title>API policies</HeadingGroup.Title>
          <HeadingGroup.Description>
            Additional restrictions when using Namera. These do not restrict direct onchain use.
          </HeadingGroup.Description>
        </HeadingGroup>
        <EvmPolicyDialog
          existingPolicyTypes={existingPolicyTypes as ReadonlyArray<EvmPolicyType>}
          isDisabled={!wallet}
          onAdd={handleAdd}
        />
      </div>

      {policies.length === 0 ? (
        <DashboardCardRoot>
          <DashboardCardContent className="px-6 py-8 text-center">
            <Typography.Paragraph color="muted" size="sm" className="text-center">
              {wallet
                ? "No additional API restrictions. Onchain permissions still apply."
                : "Select an account before adding policies."}
            </Typography.Paragraph>
          </DashboardCardContent>
        </DashboardCardRoot>
      ) : (
        <div className="grid gap-3">
          {policyFields.fields.map((field, index) => {
            const policy = policies[index];
            return policy ? (
              <EvmPolicyCard
                index={index}
                key={field.id}
                policy={policy}
                onChange={handleChange}
                onRemove={handleRemove}
              />
            ) : null;
          })}
        </div>
      )}
    </section>
  );
}
