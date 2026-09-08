// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { useId, type FormEvent } from "react";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { EvmSessionPermission } from "@namera-ai/protocol/evm";
import {
  Button,
  Checkbox,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  TextArea,
  Typography,
} from "@namera-ai/ui";
import { Controller, useForm } from "react-hook-form";

import {
  OnchainPermissionForm,
  onchainPermissionCatalog,
  type OnchainPermissionInput,
  type OnchainPermissionType,
} from "./catalog";

type Props = {
  type: OnchainPermissionType;
  onSave: (permission: OnchainPermissionInput) => void;
};

export function OnchainPermissionEditor({ type, onSave }: Props) {
  const id = useId();
  const definition = onchainPermissionCatalog[type];
  const form = useForm<
    typeof OnchainPermissionForm.Encoded,
    unknown,
    typeof OnchainPermissionForm.Type
  >({
    defaultValues: { permission: definition.initial, acknowledgeRoot: false },
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(OnchainPermissionForm)),
  });
  const textFields = [
    ...("address" in definition.initial
      ? [{ name: "permission.address" as const, label: "Contract address", placeholder: "0x…" }]
      : []),
    ...("allowance" in definition.initial
      ? [
          {
            name: "permission.allowance" as const,
            label: "Lifetime allowance (base units)",
            placeholder: "0",
          },
        ]
      : []),
    ...("limit" in definition.initial
      ? [
          {
            name: "permission.limit" as const,
            label: "Lifetime gas budget (wei)",
            placeholder: "0",
          },
        ]
      : []),
  ];
  const submit = form.handleSubmit(({ permission }) =>
    onSave(Schema.encodeSync(EvmSessionPermission)(permission)),
  );
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.stopPropagation();
    void submit(event);
  };

  return (
    <form id={id} noValidate onSubmit={handleSubmit}>
      <FieldGroup>
        <Typography.Paragraph color="muted" size="sm">
          {definition.description}
        </Typography.Paragraph>
        {textFields.map(({ name, label, placeholder }) => (
          <Controller
            key={name}
            control={form.control}
            name={name}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`${id}-${name}`}>{label}</FieldLabel>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  id={`${id}-${name}`}
                  aria-invalid={fieldState.invalid}
                  autoComplete="off"
                  fullWidth
                  placeholder={placeholder}
                  variant="secondary"
                />
                {fieldState.error ? <FieldError errors={[fieldState.error]} /> : null}
              </Field>
            )}
          />
        ))}
        {"allowance" in definition.initial || "limit" in definition.initial ? (
          <Typography.Paragraph color="muted" size="xs">
            Use whole base units: 0.01 ETH is 10000000000000000 wei; 1 USDC with 6 decimals is
            1000000. Each network gets its own allowance.
          </Typography.Paragraph>
        ) : null}
        {"functions" in definition.initial ? (
          <Controller
            control={form.control}
            name="permission.functions"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`${id}-functions`}>Function selectors</FieldLabel>
                <TextArea
                  id={`${id}-functions`}
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  value={(field.value ?? []).join("\n")}
                  onChange={(event) => field.onChange(event.target.value.split("\n"))}
                  aria-invalid={fieldState.invalid}
                  rows={3}
                  fullWidth
                  placeholder="0xa9059cbb"
                  variant="secondary"
                />
                <Typography.Paragraph color="muted" size="xs">
                  One four-byte selector per line, for example 0xa9059cbb for
                  transfer(address,uint256).
                </Typography.Paragraph>
                {fieldState.error ? <FieldError errors={[fieldState.error]} /> : null}
              </Field>
            )}
          />
        ) : null}
        {type === "root" ? (
          <Controller
            control={form.control}
            name="acknowledgeRoot"
            render={({ field }) => (
              <Checkbox
                name={field.name}
                isSelected={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              >
                <Checkbox.Content className="items-start">
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  I understand this key can control the account, including its permissions. API
                  policies do not restrict direct onchain use.
                </Checkbox.Content>
              </Checkbox>
            )}
          />
        ) : null}
        {form.formState.isSubmitted && Object.keys(form.formState.errors).length > 0 ? (
          <Typography.Paragraph className="text-danger" size="sm" role="alert">
            Check the permission fields and acknowledge unrestricted access if selected.
          </Typography.Paragraph>
        ) : null}
        <Button form={id} type="submit">
          Add permission
        </Button>
      </FieldGroup>
    </form>
  );
}
