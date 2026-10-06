// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import type { FormEvent } from "react";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { EvmSessionPermission } from "@namera-ai/protocol/evm";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  ListBox,
  Select,
  TextArea,
  Typography,
} from "@namera-ai/ui";
import { Controller, useForm, useWatch } from "react-hook-form";

import type { OnchainPermissionInput } from "@/components/policy/evm/onchain/catalog";

import { ContractAccessForm, contractAccessModes, toContractAccessForm } from "./form";

export function ContractAccessEditor({
  formId,
  initialValue,
  validatePermission,
  onSave,
}: {
  formId: string;
  initialValue?: OnchainPermissionInput | undefined;
  validatePermission: (permission: OnchainPermissionInput) => string | undefined;
  onSave: (permission: OnchainPermissionInput) => void;
}) {
  const form = useForm<typeof ContractAccessForm.Encoded, unknown, typeof ContractAccessForm.Type>({
    defaultValues: toContractAccessForm(initialValue),
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(ContractAccessForm)),
  });
  const type = useWatch({ control: form.control, name: "type" });
  const submit = form.handleSubmit((permission) => {
    const encoded = Schema.encodeSync(EvmSessionPermission)(permission);
    const conflict = validatePermission(encoded);
    if (conflict) {
      form.setError("root", { message: conflict });
      return;
    }
    onSave(encoded);
  });
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.stopPropagation();
    void submit(event);
  };

  return (
    <form id={formId} noValidate onSubmit={handleSubmit}>
      <FieldGroup>
        <Typography.Paragraph color="muted" size="sm">
          Choose which contracts this key can use and what it can do with them.
        </Typography.Paragraph>
        <FieldError errors={[form.formState.errors.root]} />
        <Controller
          control={form.control}
          name="type"
          render={({ field }) => (
            <Field>
              <FieldLabel id={`${formId}-access-mode`}>Access type</FieldLabel>
              <Select
                aria-labelledby={`${formId}-access-mode`}
                fullWidth
                variant="secondary"
                name={field.name}
                selectedKey={field.value}
                onSelectionChange={(key) => {
                  field.onChange(key);
                  form.clearErrors();
                }}
              >
                <Select.Trigger ref={field.ref} onBlur={field.onBlur}>
                  <Select.Value>
                    {contractAccessModes.find((mode) => mode.id === field.value)?.name}
                  </Select.Value>
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox items={contractAccessModes}>
                    {(mode) => (
                      <ListBox.Item id={mode.id} textValue={mode.name}>
                        {mode.name}
                      </ListBox.Item>
                    )}
                  </ListBox>
                </Select.Popover>
              </Select>
            </Field>
          )}
        />
        {type !== "functions-on-all-contracts" ? (
          <Controller
            control={form.control}
            name="address"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`${formId}-address`}>Contract address</FieldLabel>
                {fieldState.error ? (
                  <FieldError>Enter a valid contract address starting with 0x.</FieldError>
                ) : null}
                <Input
                  {...field}
                  id={`${formId}-address`}
                  fullWidth
                  variant="secondary"
                  placeholder="0x…"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-invalid={fieldState.invalid}
                />
              </Field>
            )}
          />
        ) : null}
        {type !== "contract-access" ? (
          <Controller
            control={form.control}
            name="functions"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`${formId}-functions`}>Function selectors</FieldLabel>
                {fieldState.error ? (
                  <FieldError>Enter unique four-byte selectors, such as 0xa9059cbb.</FieldError>
                ) : null}
                <TextArea
                  {...field}
                  id={`${formId}-functions`}
                  rows={3}
                  fullWidth
                  variant="secondary"
                  placeholder="0xa9059cbb"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-invalid={fieldState.invalid}
                />
                <Typography.Paragraph size="xs" color="muted">
                  Separate selectors with commas or new lines. Example: 0xa9059cbb for transfers.
                </Typography.Paragraph>
              </Field>
            )}
          />
        ) : null}
        {form.formState.isSubmitted &&
        Object.keys(form.formState.errors).length > 0 &&
        !form.formState.errors.root ? (
          <Typography.Paragraph size="xs" className="text-danger" role="alert">
            Enter a valid contract address and unique four-byte function selectors for the selected
            access type.
          </Typography.Paragraph>
        ) : null}
      </FieldGroup>
    </form>
  );
}
