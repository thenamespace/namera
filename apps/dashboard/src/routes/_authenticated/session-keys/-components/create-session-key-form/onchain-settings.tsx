// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { Field, FieldError, FieldLabel, Typography } from "@namera-ai/ui";
import { Controller, type UseFormReturn } from "react-hook-form";

import {
  DashboardCardContent,
  DashboardCardRoot,
  DashboardCardRow,
} from "@/components/dashboard-card";
import { HeadingGroup } from "@/components/heading-group";
import { DateTimePolicyField } from "@/components/policy/evm/date-time-policy-field";
import { EvmNetworkMultiSelect } from "@/components/policy/evm/network-multi-select";

import type { CreateSessionKeyFormInput, CreateSessionKeyFormValues } from "./types";

export function OnchainSettings({
  form,
}: {
  form: UseFormReturn<CreateSessionKeyFormInput, unknown, CreateSessionKeyFormValues>;
}) {
  return (
    <section className="grid gap-4">
      <HeadingGroup>
        <HeadingGroup.Title>Networks and lifetime</HeadingGroup.Title>
        <HeadingGroup.Description>
          Choose where this key can run and when its access expires.
        </HeadingGroup.Description>
      </HeadingGroup>
      <DashboardCardRoot>
        <DashboardCardContent>
          <DashboardCardRow>
            <FieldLabel id="session-networks-label">Networks</FieldLabel>
            <Controller
              control={form.control}
              name="onchain.chains"
              render={({ field, fieldState }) => (
                <Field className="w-full min-w-0" data-invalid={fieldState.invalid}>
                  <EvmNetworkMultiSelect
                    operationalOnly
                    aria-labelledby="session-networks-label"
                    name={field.name}
                    value={field.value ?? []}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    triggerRef={field.ref}
                    isInvalid={fieldState.invalid}
                  />
                  {fieldState.error ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />
          </DashboardCardRow>
          {(["validAfter", "validUntil"] as const).map((name) => {
            const required = name === "validUntil";
            const label = required ? "Expires on" : "Starts on (optional)";
            return (
              <DashboardCardRow key={name}>
                <Typography weight="medium">{label}</Typography>
                <div className="w-full min-w-0">
                  <Controller
                    control={form.control}
                    name={`onchain.${name}`}
                    render={({ field, fieldState }) => (
                      <DateTimePolicyField
                        hideLabel
                        isRequired={required}
                        label={label}
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
                </div>
              </DashboardCardRow>
            );
          })}
        </DashboardCardContent>
      </DashboardCardRoot>
    </section>
  );
}
