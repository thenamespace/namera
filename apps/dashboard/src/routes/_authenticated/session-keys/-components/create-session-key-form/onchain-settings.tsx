// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { FieldGroup } from "@namera-ai/ui";
import { Controller, type UseFormReturn } from "react-hook-form";

import { DateTimePolicyField } from "@/components/policy/evm/date-time-policy-field";

import type { CreateSessionKeyFormInput, CreateSessionKeyFormValues } from "./types";

export function OnchainSettings({
  form,
  installationIndex,
}: {
  form: UseFormReturn<CreateSessionKeyFormInput, unknown, CreateSessionKeyFormValues>;
  installationIndex: number;
}) {
  return (
    <FieldGroup>
      {(["validAfter", "validUntil"] as const).map((name) => (
        <Controller
          key={name}
          control={form.control}
          name={`onchain.installations.${installationIndex}.${name}`}
          render={({ field, fieldState }) => (
            <DateTimePolicyField
              isRequired={name === "validUntil"}
              label={name === "validUntil" ? "Expires on" : "Starts on"}
              name={field.name}
              error={fieldState.error}
              value={field.value ? new Date(field.value * 1000).toISOString() : null}
              onBlur={field.onBlur}
              onChange={(value) => field.onChange(value ? Math.floor(Date.parse(value) / 1000) : 0)}
            />
          )}
        />
      ))}
    </FieldGroup>
  );
}
