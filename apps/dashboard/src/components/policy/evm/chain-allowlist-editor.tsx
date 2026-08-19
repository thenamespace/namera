import type { FormEvent } from "react";

// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import type { SupportedEvmChainId } from "@namera-ai/protocol/evm";
import { Field, FieldGroup, FieldLabel, Typography } from "@namera-ai/ui";
import { Controller, useForm } from "react-hook-form";
import { useEventCallback } from "usehooks-ts";

import { evmChainOptions, evmPolicyFormIds } from "./data";
import { EvmNetworkMultiSelect } from "./network-multi-select";
import type { ChainAllowlistPolicyInput, EvmPolicyInput } from "./types";

const ChainAllowlistForm = Schema.Struct({
  chainIds: Schema.Array(Schema.Literals(evmChainOptions.map((chain) => chain.id))).check(
    Schema.isMinLength(1, { message: "Select at least one network" }),
  ),
});

type ChainAllowlistFormInput = typeof ChainAllowlistForm.Encoded;
type ChainAllowlistFormValues = typeof ChainAllowlistForm.Type;

const defaultChainId =
  evmChainOptions.find((chain) => chain.id === "eip155:1")?.id ?? evmChainOptions[0]?.id;
if (!defaultChainId) throw new Error("At least one supported EVM chain is required");

type ChainAllowlistPolicyEditorProps = {
  formId?: string;
  initialValue?: ChainAllowlistPolicyInput;
  onSave: (policy: EvmPolicyInput) => void;
};

export function ChainAllowlistPolicyEditor({
  formId = evmPolicyFormIds["evm.chain-allowlist"],
  initialValue,
  onSave,
}: ChainAllowlistPolicyEditorProps) {
  const form = useForm<ChainAllowlistFormInput, unknown, ChainAllowlistFormValues>({
    defaultValues: { chainIds: initialValue?.chainIds ?? [defaultChainId] },
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(ChainAllowlistForm)),
  });
  const submitPolicy = form.handleSubmit((value) => {
    onSave({ type: "evm.chain-allowlist", version: 1, chainIds: value.chainIds });
  });
  const handleSubmit = useEventCallback((event: FormEvent<HTMLFormElement>) => {
    event.stopPropagation();
    void submitPolicy(event);
  });

  return (
    <form id={formId} noValidate onSubmit={handleSubmit}>
      <FieldGroup>
        <Controller
          control={form.control}
          name="chainIds"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel id="chain-allowlist-networks">Allowed networks</FieldLabel>
              <EvmNetworkMultiSelect
                aria-labelledby="chain-allowlist-networks"
                isInvalid={fieldState.invalid}
                name={field.name}
                triggerRef={field.ref}
                value={field.value as ReadonlyArray<SupportedEvmChainId>}
                onBlur={field.onBlur}
                onChange={field.onChange}
              />
              <Typography.Paragraph color="muted" size="xs">
                Executions and signatures are denied on every network not selected here.
              </Typography.Paragraph>
              {fieldState.error ? (
                <Typography.Paragraph className="text-danger" role="alert" size="xs">
                  {fieldState.error.message ?? "Select at least one network"}
                </Typography.Paragraph>
              ) : null}
            </Field>
          )}
        />
      </FieldGroup>
    </form>
  );
}
