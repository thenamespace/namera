// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { Field, FieldError, FieldGroup, FieldLabel } from "@namera-ai/ui";
import { Controller, type UseFormReturn } from "react-hook-form";

import { DateTimePolicyField } from "@/components/policy/evm/date-time-policy-field";
import { EvmNetworkMultiSelect } from "@/components/policy/evm/network-multi-select";

import type { CreateSessionKeyFormInput, CreateSessionKeyFormValues } from "./types";

export function OnchainSettings({
  form,
  kind,
}: {
  form: UseFormReturn<CreateSessionKeyFormInput, unknown, CreateSessionKeyFormValues>;
  kind: "networks" | "lifetime";
}) {
  return (
    <FieldGroup>
      {kind === "networks" ? (
        <Controller
          control={form.control}
          name="onchain.chains"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel id="session-networks-label" isRequired>
                Allowed networks
              </FieldLabel>
              <EvmNetworkMultiSelect
                operationalOnly
                aria-labelledby="session-networks-label"
                {...(fieldState.error ? { "aria-describedby": "session-networks-error" } : {})}
                name={field.name}
                value={field.value ?? []}
                onBlur={field.onBlur}
                onChange={field.onChange}
                triggerRef={field.ref}
                isInvalid={fieldState.invalid}
              />
              {fieldState.error ? (
                <FieldError id="session-networks-error">
                  {field.value?.length
                    ? "Choose available networks. Some selected networks are paused."
                    : "Choose at least one network."}
                </FieldError>
              ) : null}
            </Field>
          )}
        />
      ) : (
        (["validAfter", "validUntil"] as const).map((name) => (
          <Controller
            key={name}
            control={form.control}
            name={`onchain.${name}`}
            render={({ field, fieldState }) => (
              <DateTimePolicyField
                isRequired={name === "validUntil"}
                label={name === "validUntil" ? "Expires on" : "Starts on"}
                name={field.name}
                error={fieldState.error}
                value={field.value ? new Date(field.value * 1000).toISOString() : null}
                onBlur={field.onBlur}
                onChange={(value) =>
                  field.onChange(value ? Math.floor(Date.parse(value) / 1000) : 0)
                }
              />
            )}
          />
        ))
      )}
    </FieldGroup>
  );
}
