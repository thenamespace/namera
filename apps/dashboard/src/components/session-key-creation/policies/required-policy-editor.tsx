import { Schema } from "effect";

// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Button } from "@namera-ai/ui";
import { useForm, type UseFormReturn } from "react-hook-form";

import { OnchainSettings } from "../onchain-settings";
import { CreateSessionKeyFormSchema } from "../schema";
import type { CreateSessionKeyFormInput, CreateSessionKeyFormValues } from "../types";
import { EnforcementPills } from "./enforcement-pills";

export function RequiredPolicyEditor({
  form,
  installationIndex,
  onClose,
}: {
  form: UseFormReturn<CreateSessionKeyFormInput, unknown, CreateSessionKeyFormValues>;
  installationIndex: number;
  onClose: () => void;
}) {
  const draft = useForm<CreateSessionKeyFormInput, unknown, CreateSessionKeyFormValues>({
    defaultValues: form.getValues(),
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(CreateSessionKeyFormSchema)),
  });
  const save = async () => {
    const fields = [
      `onchain.installations.${installationIndex}.validAfter`,
      `onchain.installations.${installationIndex}.validUntil`,
    ] as const;
    if (!(await draft.trigger([...fields]))) return;
    for (const field of fields) {
      form.setValue(field, draft.getValues(field), { shouldDirty: true, shouldValidate: true });
    }
    onClose();
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      className="grid gap-6"
    >
      <div className="grid gap-4">
        <OnchainSettings form={draft} installationIndex={installationIndex} />
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-separator pt-4">
        <EnforcementPills />
        <Button type="button" variant="tertiary" onPress={onClose}>
          Cancel
        </Button>
        <Button type="submit">Save policy</Button>
      </div>
    </form>
  );
}
