// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { DateTime, Schema } from "effect";

import { Checkbox, Field, FieldError, FieldGroup, FieldLabel, Typography } from "@namera-ai/ui";
import { Controller, type UseFormReturn } from "react-hook-form";

import { DashboardCardContent, DashboardCardRoot } from "@/components/dashboard-card";
import { HeadingGroup } from "@/components/heading-group";
import { DateTimePolicyField } from "@/components/policy/evm/date-time-policy-field";
import { EvmNetworkMultiSelect } from "@/components/policy/evm/network-multi-select";

import type { CreateSessionKeyFormInput, CreateSessionKeyFormValues } from "./types";

const lifetimeFields = [
  { name: "onchain.validAfter", label: "Starts at (optional)", required: false },
  { name: "onchain.validUntil", label: "Expires at", required: true },
] as const;

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
          Approve each network with your account’s passkey. Your agent keeps the session key
          locally.
        </HeadingGroup.Description>
      </HeadingGroup>
      <DashboardCardRoot>
        <DashboardCardContent className="p-5">
          <FieldGroup>
            <Controller
              control={form.control}
              name="onchain.chains"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel id="session-networks-label">Networks</FieldLabel>
                  <EvmNetworkMultiSelect
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
            <div className="grid gap-4 sm:grid-cols-2">
              {lifetimeFields.map(({ name, label, required }) => (
                <Controller
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field, fieldState }) => (
                    <DateTimePolicyField
                      name={field.name}
                      label={label}
                      granularity="minute"
                      isRequired={required}
                      error={fieldState.error}
                      onBlur={field.onBlur}
                      value={
                        field.value
                          ? DateTime.formatIso(DateTime.makeUnsafe(field.value * 1000))
                          : null
                      }
                      onChange={(value) =>
                        field.onChange(
                          value
                            ? Math.floor(
                                DateTime.toEpochMillis(
                                  Schema.decodeSync(Schema.DateTimeUtcFromString)(value),
                                ) / 1000,
                              )
                            : 0,
                        )
                      }
                    />
                  )}
                />
              ))}
            </div>
            <Typography.Paragraph color="muted" size="xs">
              Times use your local timezone. Leave the start empty to allow use once installation
              confirms. Execution access ends at expiry.
            </Typography.Paragraph>
            <Controller
              control={form.control}
              name="onchain.allowSignatures"
              render={({ field }) => (
                <Field>
                  <Checkbox
                    name={field.name}
                    isSelected={field.value ?? false}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  >
                    <Checkbox.Content className="items-start">
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      Allow messages and typed-data signatures
                    </Checkbox.Content>
                  </Checkbox>
                  <Typography.Paragraph color="muted" size="sm">
                    Onchain expiry and spend limits do not restrict signatures. The local key can
                    sign outside Namera until you remove its permission onchain, even after API
                    revocation.
                  </Typography.Paragraph>
                </Field>
              )}
            />
          </FieldGroup>
        </DashboardCardContent>
      </DashboardCardRoot>
    </section>
  );
}
