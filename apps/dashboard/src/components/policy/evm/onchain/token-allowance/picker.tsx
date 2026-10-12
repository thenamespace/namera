// oxlint-disable react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-jsx-as-prop
import { useId } from "react";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Button, Field, FieldError, FieldLabel, Input } from "@namera-ai/ui";
import { Coins01Icon, HugeiconsIcon } from "@namera-ai/ui/icons";
import { Controller, useForm } from "react-hook-form";

import { AddressPickerControl } from "@/components/evm-address-picker/control";
import { AddressIdentity } from "@/components/evm-address-picker/identity";
import type { AddressPickerFieldProps } from "@/components/evm-address-picker/types";

import { TokenAllowanceForm, type TokenSpendingSelection } from "./form";

const types = ["erc20"] as const;
const CustomTokenForm = Schema.Struct({
  address: TokenAllowanceForm.fields.address,
  decimals: TokenAllowanceForm.fields.decimals,
});
type CustomToken = typeof CustomTokenForm.Type;

export function TokenSpendingPicker({
  value,
  onChange,
  ...props
}: AddressPickerFieldProps & {
  value: TokenSpendingSelection | null;
  onChange: (value: TokenSpendingSelection) => void;
}) {
  return (
    <AddressPickerControl
      {...props}
      types={types}
      onSelect={onChange}
      selection={
        value?.source === "catalog" ? (
          <AddressIdentity value={value} compact />
        ) : value ? (
          <span className="flex min-w-0 items-center gap-2">
            <HugeiconsIcon icon={Coins01Icon} className="size-5 shrink-0" aria-hidden />
            <span className="truncate font-mono text-xs">
              {value.value.address.slice(0, 8)}…{value.value.address.slice(-6)}
            </span>
            <span className="text-muted text-xs">{value.value.decimals} decimals</span>
          </span>
        ) : null
      }
      renderCustom={(query, close, back) => (
        <CustomTokenFields
          initialValue={value?.source === "custom" ? value.value : null}
          initialAddress={query}
          onCancel={back}
          onConfirm={(token) => {
            onChange({ source: "custom", value: token });
            close();
          }}
        />
      )}
    />
  );
}

function CustomTokenFields({
  initialValue,
  initialAddress,
  onConfirm,
  onCancel,
}: {
  initialValue: CustomToken | null;
  initialAddress: string;
  onConfirm: (value: CustomToken) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const form = useForm<typeof CustomTokenForm.Encoded, unknown, CustomToken>({
    defaultValues: {
      address: initialValue?.address ?? (initialAddress.startsWith("0x") ? initialAddress : ""),
      decimals: initialValue ? String(initialValue.decimals) : "",
    },
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(CustomTokenForm)),
  });
  return (
    <form
      id={id}
      noValidate
      className="grid gap-3 p-3"
      onSubmit={(event) => {
        event.stopPropagation();
        void form.handleSubmit(onConfirm)(event);
      }}
    >
      <p className="text-sm font-medium">Custom token</p>
      {(["address", "decimals"] as const).map((name) => (
        <Controller
          key={name}
          control={form.control}
          name={name}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${id}-${name}`}>
                {name === "address" ? "Address" : "Decimals"}
              </FieldLabel>
              <Input
                {...field}
                id={`${id}-${name}`}
                variant="secondary"
                autoComplete="off"
                spellCheck={false}
                inputMode={name === "decimals" ? "numeric" : "text"}
                placeholder={name === "address" ? "0x…" : "e.g. 6"}
                aria-invalid={fieldState.invalid}
                aria-describedby={`${id}-${name}-error`}
              />
              <FieldError id={`${id}-${name}-error`}>{fieldState.error?.message}</FieldError>
            </Field>
          )}
        />
      ))}
      <div className="flex justify-between gap-2">
        <Button type="button" size="sm" variant="tertiary" onPress={onCancel}>
          Back to search
        </Button>
        <Button size="sm" type="submit" form={id}>
          Use token
        </Button>
      </div>
    </form>
  );
}
