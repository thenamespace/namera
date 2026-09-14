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
          Choose what this key can call. Add separate policies for other contracts; spending limits
          are configured separately.
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
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        ) : (
          <Typography.Paragraph size="xs" color="muted">
            This allows matching selectors on any contract, not just contracts you trust.
            Account-management functions remain blocked.
          </Typography.Paragraph>
        )}
        {type !== "contract-access" ? (
          <Controller
            control={form.control}
            name="functions"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`${formId}-functions`}>Function selectors</FieldLabel>
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
                  One four-byte selector per line, or separated by commas. For example, 0xa9059cbb
                  is transfer(address,uint256).
                </Typography.Paragraph>
                <FieldError errors={[fieldState.error]} />
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
