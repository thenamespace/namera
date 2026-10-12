// oxlint-disable react-perf/jsx-no-new-function-as-prop react-perf/jsx-no-new-array-as-prop

import { FieldError } from "@namera-ai/ui";
import { Calendar03Icon, Globe02Icon, HugeiconsIcon } from "@namera-ai/ui/icons";
import { useWatch, type UseFormReturn } from "react-hook-form";

import { LifetimeSummary } from "@/components/policy/evm/lifetime-summary";
import { NetworksSummary } from "@/components/policy/evm/networks-summary";
import { SessionPolicyCard } from "@/components/policy/evm/session-policy-card";

import type { CreateSessionKeyFormInput, CreateSessionKeyFormValues } from "../types";
import { RequiredPolicyEditor } from "./required-policy-editor";

const networksLogo = <HugeiconsIcon icon={Globe02Icon} />;
const lifetimeLogo = <HugeiconsIcon icon={Calendar03Icon} />;

export function RequiredPolicies({
  form,
  editing,
  disabled,
  onEdit,
  onClose,
}: {
  form: UseFormReturn<CreateSessionKeyFormInput, unknown, CreateSessionKeyFormValues>;
  editing: "networks" | "lifetime" | undefined;
  disabled: boolean;
  onEdit: (kind: "networks" | "lifetime") => void;
  onClose: () => void;
}) {
  const onchain = useWatch({ control: form.control, name: "onchain" });
  const editor = editing ? (
    <RequiredPolicyEditor form={form} kind={editing} onClose={onClose} />
  ) : null;

  return (
    <>
      <SessionPolicyCard
        name="Networks"
        logo={networksLogo}
        onEdit={() => onEdit("networks")}
        selected={editing === "networks"}
        disabled={disabled}
        editor={editing === "networks" ? editor : null}
      >
        <NetworksSummary chainIds={onchain.chains} />
      </SessionPolicyCard>
      <FieldError errors={[form.formState.errors.onchain?.chains]} />
      <SessionPolicyCard
        name="Lifetime"
        logo={lifetimeLogo}
        onEdit={() => onEdit("lifetime")}
        selected={editing === "lifetime"}
        disabled={disabled}
        editor={editing === "lifetime" ? editor : null}
      >
        <LifetimeSummary validAfter={onchain.validAfter} validUntil={onchain.validUntil} />
      </SessionPolicyCard>
      <FieldError
        errors={[
          form.formState.errors.onchain?.validAfter,
          form.formState.errors.onchain?.validUntil,
        ]}
      />
    </>
  );
}
