import type { FormEvent } from "react";

// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { CreateEvmTimeWindowPolicy } from "@namera-ai/protocol";
import { FieldGroup } from "@namera-ai/ui";
import { Controller, useForm } from "react-hook-form";
import { useEventCallback } from "usehooks-ts";

import { evmPolicyFormIds } from "../data";
import { DateTimePolicyField } from "../date-time-policy-field";
import type { EvmPolicyInput, TimeWindowPolicyInput } from "../types";

type TimeWindowPolicyValues = typeof CreateEvmTimeWindowPolicy.Type;

const emptyTimeWindow: TimeWindowPolicyInput = {
  type: "evm.time-window",
  version: 1,
  startsAt: null,
  expiresAt: "",
};

type TimeWindowPolicyEditorProps = {
  formId?: string;
  initialValue?: TimeWindowPolicyInput;
  onSave: (policy: EvmPolicyInput) => void;
};

export function TimeWindowPolicyEditor({
  formId = evmPolicyFormIds["evm.time-window"],
  initialValue = emptyTimeWindow,
  onSave,
}: TimeWindowPolicyEditorProps) {
  const form = useForm<TimeWindowPolicyInput, unknown, TimeWindowPolicyValues>({
    defaultValues: initialValue,
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(CreateEvmTimeWindowPolicy)),
  });
  const submitPolicy = form.handleSubmit((policy) => {
    onSave(Schema.encodeSync(CreateEvmTimeWindowPolicy)(policy));
  });
  const handleSubmit = useEventCallback((event: FormEvent<HTMLFormElement>) => {
    event.stopPropagation();
    void submitPolicy(event);
  });

  return (
    <form id={formId} noValidate onSubmit={handleSubmit}>
      <FieldGroup>
        <Controller
          control={form.control}
          name="startsAt"
          render={({ field, fieldState }) => (
            <DateTimePolicyField
              error={fieldState.error}
              label="Starts on"
              name={field.name}
              value={field.value}
              onBlur={field.onBlur}
              onChange={field.onChange}
            />
          )}
        />

        <Controller
          control={form.control}
          name="expiresAt"
          render={({ field, fieldState }) => (
            <DateTimePolicyField
              isRequired
              error={fieldState.error}
              label="Expires on"
              name={field.name}
              value={field.value}
              onBlur={field.onBlur}
              onChange={(nextValue) => field.onChange(nextValue ?? "")}
            />
          )}
        />
      </FieldGroup>
    </form>
  );
}
