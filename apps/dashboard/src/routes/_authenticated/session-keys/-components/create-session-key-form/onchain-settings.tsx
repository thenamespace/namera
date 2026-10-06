// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { Field, FieldError, FieldLabel } from "@namera-ai/ui";
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
        <HeadingGroup.Title size="sm">Networks and lifetime</HeadingGroup.Title>
        <HeadingGroup.Description>
          Choose where this key can run and when its access expires.
        </HeadingGroup.Description>
      </HeadingGroup>
      <DashboardCardRoot>
        <DashboardCardContent>
          <Controller
            control={form.control}
            name="onchain.chains"
            render={({ field, fieldState }) => (
              <DashboardCardRow className="items-start sm:items-start">
                <Field className="contents" data-invalid={fieldState.invalid}>
                  <div className="grid min-w-0 gap-1">
                    <FieldLabel id="session-networks-label" isRequired>
                      Networks
                    </FieldLabel>
                    <div className="min-h-5" id="session-networks-error">
                      {fieldState.error ? (
                        <FieldError>
                          {field.value?.length
                            ? "Choose available networks. Some selected networks are paused."
                            : "Choose at least one network."}
                        </FieldError>
                      ) : null}
                    </div>
                  </div>
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
                </Field>
              </DashboardCardRow>
            )}
          />
          {(["validAfter", "validUntil"] as const).map((name) => {
            const required = name === "validUntil";
            const label = required ? "Expires on" : "Starts on";
            return (
              <Controller
                key={name}
                control={form.control}
                name={`onchain.${name}`}
                render={({ field, fieldState }) => (
                  <DashboardCardRow className="items-start sm:items-start">
                    <div className="grid min-w-0 gap-1">
                      <FieldLabel isRequired={required}>{label}</FieldLabel>
                      <div className="min-h-5" id={`session-${name}-error`}>
                        {fieldState.error ? (
                          <FieldError>
                            {required
                              ? field.value
                                ? "Choose an expiry date after the start date."
                                : "Choose an expiry date."
                              : "Choose a valid start date."}
                          </FieldError>
                        ) : null}
                      </div>
                    </div>
                    <div className="w-full min-w-0">
                      <DateTimePolicyField
                        hideLabel
                        hideError
                        {...(fieldState.error
                          ? { "aria-describedby": `session-${name}-error` }
                          : {})}
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
                    </div>
                  </DashboardCardRow>
                )}
              />
            );
          })}
        </DashboardCardContent>
      </DashboardCardRoot>
    </section>
  );
}
