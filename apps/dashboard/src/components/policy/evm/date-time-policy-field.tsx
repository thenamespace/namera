// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import type { ReactNode } from "react";

import { getLocalTimeZone, today } from "@internationalized/date";
import { Calendar, DateField, DatePicker, Field, FieldError, FieldLabel } from "@namera-ai/ui";

import { encodeDateValue, parseDateValue } from "@/lib/helpers/date";

type DateTimeFieldProps = {
  error: { readonly message?: ReactNode } | undefined;
  isRequired?: boolean;
  granularity?: "day" | "minute";
  label: string;
  name: string;
  value: string | null;
  onBlur: () => void;
  onChange: (value: string | null) => void;
};

export function DateTimePolicyField({
  error,
  isRequired = false,
  granularity = "day",
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
        granularity={granularity}
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
