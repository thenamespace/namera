// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useId } from "react";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import type { EthereumAddress, SupportedEvmChainId } from "@namera-ai/protocol/evm";
import { Button, Field, FieldError, FieldLabel, Input } from "@namera-ai/ui";
import { Controller, useForm } from "react-hook-form";
import { getAddress } from "viem";

import { EvmChainSelect } from "@/components/evm-chain-select";

import { customAddressSchema } from "./schema";
import type { EvmAddressSelection } from "./types";

export function CustomAddress({
  chainIds,
  initialAddress,
  onSelect,
  onBack,
}: {
  chainIds: readonly SupportedEvmChainId[];
  initialAddress: string;
  onSelect: (value: EvmAddressSelection) => void;
  onBack: () => void;
}) {
  const id = useId();
  const schema = customAddressSchema(chainIds);
  const form = useForm<typeof schema.Encoded, unknown, typeof schema.Type>({
    defaultValues: {
      address: initialAddress.startsWith("0x") ? initialAddress : "",
      ...(chainIds[0] ? { chainId: chainIds[0] } : {}),
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
        void form.handleSubmit((value) =>
          onSelect({
            source: "custom",
            namespace: "eip155",
            chainId: value.chainId,
            address: getAddress(value.address) as EthereumAddress,
          }),
        )(event);
      }}
    >
      <p className="text-sm font-medium">Custom address</p>
      <Controller
        control={form.control}
        name="address"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={`${id}-address`}>Title</FieldLabel>
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
      <div className="flex justify-between gap-2">
        <Button size="sm" variant="tertiary" onPress={onBack}>
          Back to search
        </Button>
        <Button size="sm" type="submit" form={id}>
          Use address
        </Button>
      </div>
    </form>
  );
}
