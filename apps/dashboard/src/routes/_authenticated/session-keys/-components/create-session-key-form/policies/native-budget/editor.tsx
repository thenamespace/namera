// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import type { FormEvent } from "react";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Field, FieldError, FieldGroup, FieldLabel, InputGroup, Typography } from "@namera-ai/ui";
import { Controller, useForm } from "react-hook-form";

import type { OnchainPermissionInput } from "@/components/policy/evm/onchain/catalog";

import { NativeBudgetForm, nativeBudgetAmount, toNativeBudgetPermission } from "./form";

export function NativeBudgetEditor({
  type,
  formId,
  initialValue,
  validatePermission,
  onSave,
}: {
  type: "gas-limit" | "native-token-transfer";
  formId: string;
  initialValue?: OnchainPermissionInput | undefined;
  validatePermission: (permission: OnchainPermissionInput) => string | undefined;
  onSave: (permission: OnchainPermissionInput) => void;
}) {
  const form = useForm<typeof NativeBudgetForm.Encoded>({
    defaultValues: { amount: nativeBudgetAmount(initialValue) },
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(NativeBudgetForm)),
  });
  const submit = form.handleSubmit(({ amount }) => {
    const permission = toNativeBudgetPermission(type, amount);
    const conflict = validatePermission(permission);
    if (conflict) {
      form.setError("root", { message: conflict });
      return;
    }
    onSave(permission);
  });
  return (
    <form
      id={formId}
      noValidate
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.stopPropagation();
        void submit(event);
      }}
    >
      <FieldGroup>
        <Typography.Paragraph size="sm" color="muted">
          {type === "gas-limit"
            ? "Limit total transaction gas costs. This is a native-token budget, not a transaction count or USD amount."
            : "Limit the total native value this key can send. Contract or token access is configured separately."}
        </Typography.Paragraph>
        <Controller
          control={form.control}
          name="amount"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${formId}-amount`}>
                {type === "gas-limit" ? "Maximum gas cost" : "Maximum native spending"}
              </FieldLabel>
              <InputGroup fullWidth variant="secondary">
                <InputGroup.Input
                  {...field}
                  id={`${formId}-amount`}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.01"
                  aria-invalid={fieldState.invalid}
                />
                <InputGroup.Suffix>
                  <span className="text-xs text-muted">Native tokens</span>
                </InputGroup.Suffix>
              </InputGroup>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Typography.Paragraph size="xs" color="muted">
          Each selected network gets this amount in its native currency, for example ETH on
          Ethereum. The budget lasts for the session’s lifetime and does not reset. Zero allows no{" "}
          {type === "gas-limit" ? "gas spending" : "native value"}.
        </Typography.Paragraph>
        <FieldError errors={[form.formState.errors.root]} />
      </FieldGroup>
    </form>
  );
}
