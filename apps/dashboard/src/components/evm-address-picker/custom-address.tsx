// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useId } from "react";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { chains } from "@namera-ai/evm/chains";
import type { EthereumAddress, SupportedEvmChainId } from "@namera-ai/protocol/evm";
import { Button, Field, FieldError, FieldLabel, Input, ListBox, Select } from "@namera-ai/ui";
import { ChainIcon } from "@namera-ai/ui/icons";
import { Controller, useForm } from "react-hook-form";
import { getAddress } from "viem";

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
  const networks = Object.values(chains).filter((chain) => chainIds.includes(chain.chainId));
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
      <div>
        <p className="text-sm font-medium">Custom address</p>
        <p className="text-muted mt-1 text-xs">
          Not verified by the catalog. Check the address and network before using it in a policy.
        </p>
      </div>
      <Controller
        control={form.control}
        name="address"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={`${id}-address`}>EVM address</FieldLabel>
            <Input
              {...field}
              id={`${id}-address`}
              placeholder="0x…"
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
            <Select
              aria-labelledby={`${id}-network`}
              value={field.value}
              onChange={field.onChange}
              fullWidth
            >
              <Select.Trigger ref={field.ref} onBlur={field.onBlur}>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {networks.map((network) => (
                    <ListBox.Item
                      key={network.chainId}
                      id={network.chainId}
                      textValue={network.chain.name}
                    >
                      <ChainIcon namespace="eip155" chain={network.name} className="size-4" />
                      {network.chain.name}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <FieldError>{fieldState.error?.message}</FieldError>
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
