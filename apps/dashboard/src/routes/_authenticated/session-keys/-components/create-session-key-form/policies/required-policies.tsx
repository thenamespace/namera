// oxlint-disable react-perf/jsx-no-new-function-as-prop react-perf/jsx-no-new-array-as-prop
import { useState } from "react";

import { FieldError } from "@namera-ai/ui";
import { Calendar03Icon, Globe02Icon } from "@namera-ai/ui/icons";
import { useWatch, type UseFormReturn } from "react-hook-form";

import { evmChainById } from "@/components/policy/evm/data";

import type { CreateSessionKeyFormInput, CreateSessionKeyFormValues } from "../types";
import { SessionPolicyCard } from "./card";
import { RequiredPolicyDialog } from "./required-policy-dialog";

const formatDate = (seconds: number) =>
  new Date(seconds * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

export function RequiredPolicies({
  form,
}: {
  form: UseFormReturn<CreateSessionKeyFormInput, unknown, CreateSessionKeyFormValues>;
}) {
  const [editing, setEditing] = useState<"networks" | "lifetime" | null>(null);
  const onchain = useWatch({ control: form.control, name: "onchain" });
  const networks = (onchain.chains ?? []).map((id) => evmChainById.get(id)?.name ?? id);

  return (
    <>
      <SessionPolicyCard
        name="Networks"
        icon={Globe02Icon}
        enforcement="Onchain"
        onEdit={() => setEditing(editing === "networks" ? null : "networks")}
      >
        {networks.length ? networks.join(", ") : "Choose at least one network."}
      </SessionPolicyCard>
      <FieldError errors={[form.formState.errors.onchain?.chains]} />
      <SessionPolicyCard
        name="Lifetime"
        icon={Calendar03Icon}
        enforcement="Onchain"
        onEdit={() => setEditing(editing === "lifetime" ? null : "lifetime")}
      >
        {onchain.validAfter ? `Starts ${formatDate(onchain.validAfter)}` : "Starts immediately"}
        {" · "}
        {onchain.validUntil
          ? `Expires ${formatDate(onchain.validUntil)}`
          : "Choose an expiry date."}
      </SessionPolicyCard>
      <FieldError
        errors={[
          form.formState.errors.onchain?.validAfter,
          form.formState.errors.onchain?.validUntil,
        ]}
      />
      {editing ? (
        <RequiredPolicyDialog form={form} kind={editing} onClose={() => setEditing(null)} />
      ) : null}
    </>
  );
}
