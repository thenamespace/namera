// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import type { FormEvent } from "react";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { CreateEvmSessionKeyPolicy } from "@namera-ai/protocol/model";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  TextArea,
  Typography,
} from "@namera-ai/ui";
import { Controller, useForm } from "react-hook-form";

import type { EvmPolicyEditorProps, EvmPolicyInput } from "./types";

type Props = EvmPolicyEditorProps & { initialValue: EvmPolicyInput };
export function OffchainPermissionEditor({ initialValue, formId, onSave }: Props) {
  const form = useForm<EvmPolicyInput, unknown, typeof CreateEvmSessionKeyPolicy.Type>({
    defaultValues: initialValue,
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(CreateEvmSessionKeyPolicy)),
  });
  const submit = form.handleSubmit((value) =>
    onSave(Schema.encodeSync(CreateEvmSessionKeyPolicy)(value)),
  );
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.stopPropagation();
    void submit(event);
  };
  return (
    <form id={formId} noValidate onSubmit={onSubmit}>
      <FieldGroup>
        {"address" in initialValue ? (
          <Controller
            control={form.control}
            name="address"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`${formId}-address`}>Contract address</FieldLabel>
                <Input
                  {...field}
                  id={`${formId}-address`}
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  autoComplete="off"
                  fullWidth
                  variant="secondary"
                  placeholder="0x…"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        ) : null}
        {"functions" in initialValue ? (
          <Controller
            control={form.control}
            name="functions"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`${formId}-functions`}>Function selectors</FieldLabel>
                <TextArea
                  ref={field.ref}
                  name={field.name}
                  onBlur={field.onBlur}
                  id={`${formId}-functions`}
                  fullWidth
                  variant="secondary"
                  rows={3}
                  placeholder="0xa9059cbb"
                  value={field.value?.join("\n") ?? ""}
                  onChange={(event) => field.onChange(event.target.value.split("\n"))}
                  aria-invalid={fieldState.invalid}
                />
                <Typography.Paragraph size="xs" color="muted">
                  One four-byte selector per line.
                </Typography.Paragraph>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        ) : null}
        {"allowance" in initialValue ? (
          <Controller
            control={form.control}
            name="allowance"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`${formId}-allowance`}>
                  Lifetime allowance (base units)
                </FieldLabel>
                <Input
                  {...field}
                  id={`${formId}-allowance`}
                  fullWidth
                  variant="secondary"
                  aria-invalid={fieldState.invalid}
                />
                <Typography.Paragraph size="xs" color="muted">
                  Transfers and approvals consume this budget. Other calls are blocked. Previously
                  approved or external spending is not tracked.
                </Typography.Paragraph>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        ) : null}
      </FieldGroup>
    </form>
  );
}
