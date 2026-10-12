// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { useId, useState } from "react";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  Button,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Typography,
} from "@namera-ai/ui";
import { Controller, useForm } from "react-hook-form";

import { EvmErc20Picker, type EvmErc20Selection } from "@/components/evm-erc20-picker";

import type { OnchainPermissionEditorProps } from "../editor";
import {
  tokenSpendingForm,
  tokenSelectionFields,
  tokenAllowanceDefaults,
  toTokenAllowancePermission,
} from "./form";

export function TokenAllowanceEditor({
  chainIds,
  initialValue,
  formId,
  hideSubmit,
  description,
  validatePermission,
  onSave,
}: OnchainPermissionEditorProps) {
  const generatedId = useId();
  const id = formId ?? generatedId;
  const [selection, setSelection] = useState<EvmErc20Selection | null>(null);
  const schema = tokenSpendingForm(chainIds);
  const form = useForm<typeof schema.Encoded, unknown, typeof schema.Type>({
    defaultValues: { token: tokenAllowanceDefaults(initialValue), chainId: "" },
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(schema)),
  });
  const submit = form.handleSubmit((value) => {
    const permission = toTokenAllowancePermission(value.token);
    const conflict = validatePermission?.(permission);
    if (conflict) {
      form.setError("root", { message: conflict });
      return;
    }
    onSave(permission);
  });
  return (
    <form
      id={id}
      noValidate
      onSubmit={(event) => {
        event.stopPropagation();
        void submit(event);
      }}
    >
      <FieldGroup>
        <Typography.Paragraph size="sm" color="muted">
          {description ??
            "Allow transfers and approvals for one token within a lifetime allowance."}
        </Typography.Paragraph>
        <div className="grid gap-4">
          <Controller
            control={form.control}
            name="token.address"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || Boolean(form.formState.errors.chainId)}>
                <FieldLabel htmlFor={`${id}-token`}>Token</FieldLabel>
                <EvmErc20Picker
                  id={`${id}-token`}
                  chainIds={chainIds}
                  value={selection}
                  label="Select token"
                  onBlur={field.onBlur}
                  isInvalid={fieldState.invalid || Boolean(form.formState.errors.chainId)}
                  aria-describedby={`${id}-token-error`}
                  onChange={(next) => {
                    setSelection(next);
                    if (!next) {
                      field.onChange("");
                      form.setValue("chainId", "", { shouldValidate: true });
                      return;
                    }
                    const selected = tokenSelectionFields(next, initialValue);
                    field.onChange(selected.address);
                    form.setValue("token.decimals", selected.decimals, { shouldValidate: true });
                    form.setValue("chainId", selected.chainId, { shouldValidate: true });
                    if (!form.getFieldState("token.amount").isDirty) {
                      form.setValue("token.amount", selected.amount);
                    }
                  }}
                />
                <FieldError id={`${id}-token-error`}>
                  {fieldState.error || form.formState.errors.chainId
                    ? "Select a token on one of the session networks."
                    : undefined}
                </FieldError>
              </Field>
            )}
          />
          {initialValue && !selection ? (
            <Typography.Paragraph size="xs" color="muted">
              Reselect the token to confirm its network and decimals. The saved allowance is
              preserved when selecting the same address.
            </Typography.Paragraph>
          ) : null}
          <Controller
            control={form.control}
            name="token.amount"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`${id}-amount`}>Lifetime allowance</FieldLabel>
                {fieldState.error ? <FieldError>{fieldState.error.message}</FieldError> : null}
                <Input
                  {...field}
                  id={`${id}-amount`}
                  disabled={!selection}
                  fullWidth
                  variant="secondary"
                  inputMode="decimal"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="100"
                  aria-invalid={fieldState.invalid}
                />
              </Field>
            )}
          />
        </div>
        <Typography.Paragraph size="xs" color="muted">
          {selection ? `${tokenSelectionFields(selection).decimals} token decimals. ` : ""}
          This address and allowance apply separately on every selected session network, not only
          the token’s network.
        </Typography.Paragraph>
        <FieldError errors={[form.formState.errors.root]} />
        {!hideSubmit ? (
          <Button form={id} type="submit">
            Save policy
          </Button>
        ) : null}
      </FieldGroup>
    </form>
  );
}
