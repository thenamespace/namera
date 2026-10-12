// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useId } from "react";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import type { EthereumAddress } from "@namera-ai/protocol/evm";
import { Button, Field, FieldError, FieldLabel, Input } from "@namera-ai/ui";
import { Controller, useForm } from "react-hook-form";
import { getAddress } from "viem";

import { EvmChainSelect } from "@/components/evm-chain-select";

import { customPickerSchema } from "./schema";
import type { CustomAddressRenderProps, EvmCustomAddress } from "./types";

type CustomToken = EvmCustomAddress & { readonly decimals: number };
type Props =
  | (CustomAddressRenderProps<EvmCustomAddress> & { mode: "contract" })
  | (CustomAddressRenderProps<CustomToken> & { mode: "erc20" });

export function CustomAddress(props: Props) {
  const { chainIds, initialAddress, initialValue, onCancel } = props;
  const id = useId();
  const schema = customPickerSchema(chainIds, props.mode === "erc20");
  const form = useForm<typeof schema.Encoded, unknown, typeof schema.Type>({
    defaultValues: {
      address: initialValue?.address ?? (initialAddress.startsWith("0x") ? initialAddress : ""),
      ...(chainIds[0] ? { chainId: initialValue?.chainId ?? chainIds[0] } : {}),
      ...(props.mode === "erc20" && props.initialValue
        ? { decimals: props.initialValue.decimals }
        : {}),
    },
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(schema)),
  });
  return (
    <form
      id={id}
      noValidate
      className="grid gap-4 p-4"
      onSubmit={(event) => {
        event.stopPropagation();
        void form.handleSubmit((value) => {
          const address = {
            chainId: value.chainId,
            address: getAddress(value.address) as EthereumAddress,
          };
          if (props.mode === "erc20") {
            if (value.decimals !== undefined)
              props.onConfirm({ ...address, decimals: value.decimals });
          } else props.onConfirm(address);
        })(event);
      }}
    >
      <p className="text-sm font-medium">Custom address</p>
      <Controller
        control={form.control}
        name="address"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={`${id}-address`}>Address</FieldLabel>
            <Input
              {...field}
              id={`${id}-address`}
              placeholder="0x…"
              variant="secondary"
              autoComplete="off"
              spellCheck={false}
              className="font-mono text-sm"
              aria-invalid={fieldState.invalid}
              aria-describedby={fieldState.error ? `${id}-address-error` : undefined}
            />
            <FieldError id={`${id}-address-error`}>{fieldState.error?.message}</FieldError>
          </Field>
        )}
      />
      <Controller
        control={form.control}
        name="chainId"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel id={`${id}-network`}>Network</FieldLabel>
            <EvmChainSelect
              aria-labelledby={`${id}-network`}
              {...(fieldState.error ? { "aria-describedby": `${id}-network-error` } : {})}
              chainIds={chainIds}
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              triggerRef={field.ref}
              isInvalid={fieldState.invalid}
            />
            <FieldError id={`${id}-network-error`}>{fieldState.error?.message}</FieldError>
          </Field>
        )}
      />
      {props.mode === "erc20" ? (
        <Controller
          control={form.control}
          name="decimals"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${id}-decimals`}>Decimals</FieldLabel>
              <Input
                {...field}
                value={field.value ?? ""}
                onChange={(event) =>
                  field.onChange(event.target.value === "" ? undefined : event.target.valueAsNumber)
                }
                id={`${id}-decimals`}
                type="number"
                min={0}
                max={255}
                step={1}
                variant="secondary"
                placeholder="e.g. 6"
                aria-invalid={fieldState.invalid}
                aria-describedby={fieldState.error ? `${id}-decimals-error` : undefined}
              />
              <FieldError id={`${id}-decimals-error`}>{fieldState.error?.message}</FieldError>
            </Field>
          )}
        />
      ) : null}
      <div className="flex justify-between gap-2">
        <Button size="sm" variant="tertiary" onPress={onCancel}>
          Back to search
        </Button>
        <Button size="sm" type="submit" form={id}>
          Use address
        </Button>
      </div>
    </form>
  );
}
