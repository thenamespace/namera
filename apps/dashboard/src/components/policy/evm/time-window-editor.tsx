import type { FormEvent, ReactNode } from "react";

// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { getLocalTimeZone, today } from "@internationalized/date";
import { CreateEvmTimeWindowPolicy } from "@namera-ai/protocol";
import {
  Calendar,
  DateField,
  DatePicker,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@namera-ai/ui";
import { Controller, useForm } from "react-hook-form";
import { useEventCallback } from "usehooks-ts";

import { encodeDateValue, parseDateValue } from "@/lib/helpers/date";

import { evmPolicyFormIds } from "./data";
import type { EvmPolicyInput, TimeWindowPolicyInput } from "./types";

type TimeWindowPolicyValues = typeof CreateEvmTimeWindowPolicy.Type;

const emptyTimeWindow: TimeWindowPolicyInput = {
  type: "evm.time-window",
  version: 1,
  startsAt: null,
  expiresAt: "",
};

type DateTimeFieldProps = {
  error: { readonly message?: ReactNode } | undefined;
  isRequired?: boolean;
  label: string;
  name: string;
  value: string | null;
  onBlur: () => void;
  onChange: (value: string | null) => void;
};

function DateTimePolicyField({
  error,
  isRequired = false,
  label,
  name,
  value,
  onBlur,
  onChange,
}: DateTimeFieldProps) {
  const minimumDate = today(getLocalTimeZone());

  return (
    <Field data-invalid={Boolean(error)}>
      <DatePicker
        className="w-full"
        granularity="day"
        isInvalid={Boolean(error)}
        isRequired={isRequired}
        minValue={minimumDate}
        name={name}
        value={parseDateValue(value)}
        onBlur={onBlur}
        onChange={(date) => onChange(encodeDateValue(date))}
      >
        <FieldLabel>{label}</FieldLabel>
        <DateField.Group fullWidth variant="secondary">
          <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
          <DateField.Suffix>
            <DatePicker.Trigger>
              <DatePicker.TriggerIndicator />
            </DatePicker.Trigger>
          </DateField.Suffix>
        </DateField.Group>
        {error ? <FieldError errors={[error]} /> : null}
        <DatePicker.Popover className="flex flex-col gap-3">
          <Calendar aria-label={`Choose ${label.toLowerCase()}`} minValue={minimumDate}>
            <Calendar.Header>
              <Calendar.YearPickerTrigger>
                <Calendar.YearPickerTriggerHeading />
                <Calendar.YearPickerTriggerIndicator />
              </Calendar.YearPickerTrigger>
              <Calendar.NavButton slot="previous" />
              <Calendar.NavButton slot="next" />
            </Calendar.Header>
            <Calendar.Grid>
              <Calendar.GridHeader>
                {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
              </Calendar.GridHeader>
              <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
            </Calendar.Grid>
            <Calendar.YearPickerGrid>
              <Calendar.YearPickerGridBody>
                {({ year }) => <Calendar.YearPickerCell year={year} />}
              </Calendar.YearPickerGridBody>
            </Calendar.YearPickerGrid>
          </Calendar>
        </DatePicker.Popover>
      </DatePicker>
    </Field>
  );
}

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
              label="Starts at"
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
              label="Expires at"
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
