import type { FormEvent, ReactNode } from "react";

// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { getLocalTimeZone, now } from "@internationalized/date";
import { CreateEvmTimeWindowPolicy } from "@namera-ai/protocol";
import {
  Button,
  Calendar,
  DateField,
  DatePicker,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  ItemCard,
  Modal,
  Typography,
} from "@namera-ai/ui";
import { Delete02Icon, HugeiconsIcon, PencilEdit02Icon } from "@namera-ai/ui/icons";
import { Controller, useForm } from "react-hook-form";
import { useEventCallback } from "usehooks-ts";

import { encodeDateValue, formatDateTime, parseDateValue } from "@/lib/helpers/date";

import type { CreateSessionKeyFormInput } from "../../types";
import { timeWindowPolicy } from "../data";

type TimeWindowPolicyInput = typeof CreateEvmTimeWindowPolicy.Encoded;
type TimeWindowPolicyValues = typeof CreateEvmTimeWindowPolicy.Type;
type SessionKeyPolicyInput = CreateSessionKeyFormInput["policies"][number];

const timeWindowFormId = "time-window-policy-form";
const emptyTimeWindow: TimeWindowPolicyInput = {
  type: timeWindowPolicy.type,
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

function DateTimeField({
  error,
  isRequired = false,
  label,
  name,
  value,
  onBlur,
  onChange,
}: DateTimeFieldProps) {
  return (
    <Field data-invalid={Boolean(error)}>
      <DatePicker
        className="w-full"
        granularity="day"
        isInvalid={Boolean(error)}
        isRequired={isRequired}
        minValue={now(getLocalTimeZone())}
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
          <Calendar aria-label={`Choose ${label.toLowerCase()}`}>
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
  onSave: (policy: SessionKeyPolicyInput) => void;
};

export function TimeWindowPolicyEditor({
  formId = timeWindowFormId,
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
            <DateTimeField
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
            <DateTimeField
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

type TimeWindowPolicyCardProps = {
  index: number;
  policy: TimeWindowPolicyInput;
  onChange: (index: number, policy: SessionKeyPolicyInput) => void;
  onRemove: (index: number) => void;
};

export function TimeWindowPolicyCard({
  index,
  policy,
  onChange,
  onRemove,
}: TimeWindowPolicyCardProps) {
  const summary = `${policy.startsAt ? `From ${formatDateTime(policy.startsAt)}` : "Available immediately"} · Expires ${formatDateTime(policy.expiresAt)}`;
  const handleSave = useEventCallback((nextPolicy: SessionKeyPolicyInput) =>
    onChange(index, nextPolicy),
  );
  const handleRemove = useEventCallback(() => onRemove(index));

  return (
    <ItemCard className="rounded-lg" variant="outline">
      <ItemCard.Icon>
        <HugeiconsIcon icon={timeWindowPolicy.icon} />
      </ItemCard.Icon>
      <ItemCard.Content>
        <ItemCard.Title>{timeWindowPolicy.name}</ItemCard.Title>
        <ItemCard.Description>{summary}</ItemCard.Description>
      </ItemCard.Content>
      <ItemCard.Action>
        <div className="flex items-center gap-1">
          <Modal>
            <Button
              isIconOnly
              aria-label={`Edit ${timeWindowPolicy.name} policy`}
              size="sm"
              type="button"
              variant="tertiary"
            >
              <HugeiconsIcon icon={PencilEdit02Icon} />
            </Button>
            <Modal.Backdrop>
              <Modal.Container size="md">
                <Modal.Dialog>
                  {({ close }) => (
                    <>
                      <Modal.CloseTrigger />
                      <Modal.Header>
                        <Modal.Heading>Edit {timeWindowPolicy.name.toLowerCase()}</Modal.Heading>
                      </Modal.Header>
                      <Modal.Body className="grid gap-5">
                        <Typography.Paragraph color="muted" size="sm">
                          {timeWindowPolicy.description}
                        </Typography.Paragraph>
                        <TimeWindowPolicyEditor
                          initialValue={policy}
                          onSave={(nextPolicy) => {
                            handleSave(nextPolicy);
                            close();
                          }}
                        />
                      </Modal.Body>
                      <Modal.Footer>
                        <Button type="button" variant="secondary" onPress={close}>
                          Cancel
                        </Button>
                        <Button form={timeWindowFormId} type="submit">
                          Save changes
                        </Button>
                      </Modal.Footer>
                    </>
                  )}
                </Modal.Dialog>
              </Modal.Container>
            </Modal.Backdrop>
          </Modal>
          <Button
            isIconOnly
            aria-label={`Remove ${timeWindowPolicy.name} policy`}
            size="sm"
            type="button"
            variant="tertiary"
            onPress={handleRemove}
          >
            <HugeiconsIcon icon={Delete02Icon} />
          </Button>
        </div>
      </ItemCard.Action>
    </ItemCard>
  );
}
