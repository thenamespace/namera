// oxlint-disable react-perf/jsx-no-new-function-as-prop react-perf/jsx-no-new-array-as-prop

import { FieldError } from "@namera-ai/ui";
import { Calendar03Icon, HugeiconsIcon } from "@namera-ai/ui/icons";
import { useWatch, type UseFormReturn } from "react-hook-form";

import { LifetimeSummary } from "@/components/policy/evm/lifetime-summary";
import { SessionPolicyCard } from "@/components/policy/evm/session-policy-card";

import type { CreateSessionKeyFormInput, CreateSessionKeyFormValues } from "../types";
import { RequiredPolicyEditor } from "./required-policy-editor";

const lifetimeLogo = <HugeiconsIcon icon={Calendar03Icon} />;

export function RequiredPolicies({
  form,
  installationIndex,
  editing,
  disabled,
  onEdit,
  onClose,
}: {
  form: UseFormReturn<CreateSessionKeyFormInput, unknown, CreateSessionKeyFormValues>;
  installationIndex: number;
  editing: "lifetime" | undefined;
  disabled: boolean;
  onEdit: (kind: "lifetime") => void;
  onClose: () => void;
}) {
  const installations = useWatch({
    control: form.control,
    name: "onchain.installations",
  });
  const onchain = installations[installationIndex];
  if (!onchain) throw new Error("Missing lifetime editor scope");
  const errors = form.formState.errors.onchain?.installations?.[installationIndex];
  const editor = editing ? (
    <RequiredPolicyEditor form={form} installationIndex={installationIndex} onClose={onClose} />
  ) : null;

  return (
    <>
      <SessionPolicyCard
        name="Start and expiry"
        logo={lifetimeLogo}
        onEdit={() => onEdit("lifetime")}
        selected={editing === "lifetime"}
        disabled={disabled}
        editor={editing === "lifetime" ? editor : null}
      >
        <LifetimeSummary validAfter={onchain.validAfter} validUntil={onchain.validUntil} />
      </SessionPolicyCard>
      <FieldError errors={[errors?.validAfter, errors?.validUntil]} />
    </>
  );
}
