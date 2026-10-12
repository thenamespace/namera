// oxlint-disable react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-jsx-as-prop
import { useId } from "react";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { EthereumAddress } from "@namera-ai/protocol/evm";
import { Button, Field, FieldLabel, FieldError, Input, TextArea } from "@namera-ai/ui";
import { ContractsIcon, HugeiconsIcon } from "@namera-ai/ui/icons";
import { Controller, useForm } from "react-hook-form";

import { AddressPickerControl } from "@/components/evm-address-picker/control";
import { AddressIdentity } from "@/components/evm-address-picker/identity";
import type {
  AddressPickerFieldProps,
  EvmAddressSelection,
} from "@/components/evm-address-picker/types";

import { ContractAbiText } from "./abi";

export type ContractTarget =
  | EvmAddressSelection<"contract" | "erc20">
  | {
      source: "custom";
      address: EthereumAddress;
      abi: string;
    };
const types = ["contract", "erc20"] as const;
const customContractSchema = (requireAbi: boolean) =>
  Schema.Struct({
    address: Schema.String.pipe(Schema.decodeTo(EthereumAddress)),
    abi: requireAbi ? ContractAbiText : Schema.String,
  });

export function ContractTargetPicker({
  value,
  onChange,
  requireAbi,
  ...props
}: AddressPickerFieldProps & {
  value: ContractTarget | null;
  onChange: (value: ContractTarget) => void;
  requireAbi: boolean;
}) {
  return (
    <AddressPickerControl<"contract" | "erc20">
      {...props}
      types={types}
      onSelect={onChange}
      selection={
        value?.source === "catalog" ? (
          <AddressIdentity value={value} compact />
        ) : value ? (
          <span className="flex items-center gap-2">
            <HugeiconsIcon icon={ContractsIcon} className="size-4" />
            <span className="font-mono text-xs">
              {value.address.slice(0, 8)}…{value.address.slice(-6)}
            </span>
          </span>
        ) : null
      }
      renderCustom={(query, close, back) => (
        <CustomContractFields
          requireAbi={requireAbi}
          initialValue={value?.source === "custom" ? value : null}
          query={query}
          onCancel={back}
          onConfirm={(next) => {
            onChange(next);
            close();
          }}
        />
      )}
    />
  );
}

function CustomContractFields({
  requireAbi,
  initialValue,
  query,
  onCancel,
  onConfirm,
}: {
  requireAbi: boolean;
  initialValue: Extract<ContractTarget, { source: "custom" }> | null;
  query: string;
  onCancel: () => void;
  onConfirm: (value: ContractTarget) => void;
}) {
  const id = useId();
  const schema = customContractSchema(requireAbi);
  const form = useForm<typeof schema.Encoded, unknown, typeof schema.Type>({
    defaultValues: {
      address: initialValue?.address ?? (query.startsWith("0x") ? query : ""),
      abi: initialValue?.abi ?? "",
    },
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(schema)),
  });
  return (
    <form
      id={id}
      noValidate
      className="grid gap-3 p-3"
      onSubmit={(event) => {
        event.stopPropagation();
        void form.handleSubmit((value) => onConfirm({ source: "custom", ...value }))(event);
      }}
    >
      <p className="text-sm font-medium">Custom contract</p>
      <Controller
        control={form.control}
        name="address"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={`${id}-address`}>Address</FieldLabel>
            <Input
              {...field}
              id={`${id}-address`}
              variant="secondary"
              placeholder="0x…"
              aria-invalid={fieldState.invalid}
            />
            <FieldError>{fieldState.error?.message}</FieldError>
          </Field>
        )}
      />
      {requireAbi ? (
        <Controller
          control={form.control}
          name="abi"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${id}-abi`}>Contract ABI</FieldLabel>
              <TextArea
                {...field}
                id={`${id}-abi`}
                rows={5}
                variant="secondary"
                placeholder="Paste JSON ABI"
                aria-invalid={fieldState.invalid}
              />
              <FieldError>{fieldState.error?.message}</FieldError>
            </Field>
          )}
        />
      ) : null}
      <div className="flex justify-between gap-2">
        <Button type="button" size="sm" variant="tertiary" onPress={onCancel}>
          Back to search
        </Button>
        <Button type="submit" form={id} size="sm">
          Use contract
        </Button>
      </div>
    </form>
  );
}
