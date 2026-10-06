// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { useId } from "react";

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

import type { OnchainPermissionEditorProps } from "../editor";
import { TokenAllowanceForm, tokenAllowanceDefaults, toTokenAllowancePermission } from "./form";

export function TokenAllowanceEditor({
  initialValue,
  formId,
  hideSubmit,
  description,
  validatePermission,
  onSave,
}: OnchainPermissionEditorProps) {
  const generatedId = useId();
  const id = formId ?? generatedId;
  const form = useForm<typeof TokenAllowanceForm.Encoded, unknown, typeof TokenAllowanceForm.Type>({
    defaultValues: tokenAllowanceDefaults(initialValue),
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(TokenAllowanceForm)),
  });
  const submit = form.handleSubmit((value) => {
    const permission = toTokenAllowancePermission(value);
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
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-[minmax(0,1fr)_7rem]">
          {(["address", "amount", "decimals"] as const).map((name) => (
            <Controller
              key={name}
              control={form.control}
              name={name}
              render={({ field, fieldState }) => (
                <Field
                  className={name === "address" ? "sm:col-span-2" : undefined}
                  data-invalid={fieldState.invalid}
                >
                  <FieldLabel htmlFor={`${id}-${name}`}>
                    {name === "address"
                      ? "Token address"
                      : name === "amount"
                        ? "Lifetime allowance"
                        : "Decimals"}
                  </FieldLabel>
                  {fieldState.error ? (
                    <FieldError>
                      {name === "address"
                        ? "Enter a valid token address starting with 0x."
                        : name === "decimals"
                          ? "Enter token decimals from 0 to 255."
                          : fieldState.error.message}
                    </FieldError>
                  ) : null}
                  <Input
                    {...field}
                    id={`${id}-${name}`}
                    fullWidth
                    variant="secondary"
                    inputMode={
                      name === "amount" ? "decimal" : name === "decimals" ? "numeric" : "text"
                    }
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder={name === "address" ? "0x…" : name === "amount" ? "100" : "6"}
                    aria-invalid={fieldState.invalid}
                  />
                </Field>
              )}
            />
          ))}
        </div>
        <Typography.Paragraph size="xs" color="muted">
          Decimals: 6 for USDC, 18 for most tokens. The allowance applies separately on each
          network.
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
