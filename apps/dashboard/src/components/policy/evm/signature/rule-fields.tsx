/* oxlint-disable react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-new-object-as-prop */
import { useState } from "react";

import { EthereumAddress } from "@namera-ai/protocol/evm";
import { Button, Checkbox, Field, FieldError, FieldLabel, Input } from "@namera-ai/ui";
import { Delete02Icon, HugeiconsIcon } from "@namera-ai/ui/icons";
import { Controller, useController, useWatch, type Control } from "react-hook-form";
import { isAddress } from "viem";

import { EvmAddressPickerWithoutNetwork } from "@/components/evm-address-picker-without-network";
import type { EvmAddressValue, EvmCustomAddress } from "@/components/evm-address-picker/types";
import { EvmChainSelect } from "@/components/evm-chain-select";

import { evmChainOptions } from "../data";
import type { SignatureFormInput, SignaturePolicyForm } from "./form";

const chainIds = evmChainOptions.map((chain) => chain.id);
const contractTypes = ["contract", "erc20"] as const;
type VerifyingContractSelection = EvmAddressValue<(typeof contractTypes)[number], EvmCustomAddress>;

const textFields = [
  { key: "primaryTypes", label: "Message types", placeholder: "Permit, Authorization" },
] as const;

export function SignatureRuleFields({
  control,
  index,
  onRemove,
}: {
  control: Control<SignatureFormInput, unknown, typeof SignaturePolicyForm.Type>;
  index: number;
  onRemove: () => void;
}) {
  const chainId = useWatch({ control, name: `rules.${index}.chainId` });
  const { field: contract, fieldState: contractState } = useController({
    control,
    name: `rules.${index}.verifyingContract`,
  });
  const [selection, setSelection] = useState<VerifyingContractSelection | null>(null);
  const selectedAddress = selection?.source === "catalog" ? selection.deployment : selection?.value;
  const selectedChainId = chainIds.find((id) => id === chainId);
  const contractValue: VerifyingContractSelection | null =
    selectedAddress?.chainId === chainId && selectedAddress.address === contract.value
      ? selection
      : selectedChainId && isAddress(contract.value)
        ? {
            source: "custom",
            value: { chainId: selectedChainId, address: EthereumAddress.make(contract.value) },
          }
        : null;

  return (
    <div className="border-separator bg-surface/40 grid gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted text-xs">Rule {index + 1}</span>
        <Button
          isIconOnly
          aria-label={`Remove typed-data rule ${index + 1}`}
          size="sm"
          type="button"
          variant="tertiary"
          onPress={onRemove}
        >
          <HugeiconsIcon icon={Delete02Icon} />
        </Button>
      </div>
      <Controller
        control={control}
        name={`rules.${index}.chainId`}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel id={`typed-data-network-${index}`}>Network</FieldLabel>
            {fieldState.error ? <FieldError>Choose a network for this rule.</FieldError> : null}
            <EvmChainSelect
              aria-labelledby={`typed-data-network-${index}`}
              chainIds={chainIds}
              isInvalid={fieldState.invalid}
              name={field.name}
              value={chainIds.find((id) => id === field.value) ?? null}
              variant="secondary"
              onChange={(next) => {
                field.onChange(next);
                if (next !== field.value) {
                  setSelection(null);
                  contract.onChange("");
                }
              }}
              onBlur={field.onBlur}
              triggerRef={field.ref}
            />
          </Field>
        )}
      />
      <Field data-invalid={contractState.invalid}>
        <FieldLabel htmlFor={`typed-data-contract-${index}`}>Verifying contract</FieldLabel>
        {selectedChainId ? (
          <EvmAddressPickerWithoutNetwork
            id={`typed-data-contract-${index}`}
            label="Select contract"
            chainId={selectedChainId}
            types={contractTypes}
            value={contractValue}
            isInvalid={contractState.invalid}
            popoverClassName="border border-separator"
            aria-describedby={`typed-data-contract-error-${index}`}
            onBlur={contract.onBlur}
            onChange={(next) => {
              setSelection(next);
              contract.onChange(
                next?.source === "catalog" ? next.deployment.address : (next?.value.address ?? ""),
              );
            }}
          />
        ) : null}
        <FieldError id={`typed-data-contract-error-${index}`}>
          {contractState.error ? "Select a contract or enter a custom address." : undefined}
        </FieldError>
      </Field>
      {textFields.map(({ key, label, placeholder }) => (
        <Controller
          key={key}
          control={control}
          name={`rules.${index}.${key}`}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`typed-data-${index}-${key}`}>{label}</FieldLabel>
              {fieldState.error ? (
                <FieldError>Enter unique message type names, separated by commas.</FieldError>
              ) : null}
              <Input
                {...field}
                aria-invalid={fieldState.invalid}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                id={`typed-data-${index}-${key}`}
                placeholder={placeholder}
                variant="secondary"
              />
            </Field>
          )}
        />
      ))}
      {(
        [
          { key: "name", match: "matchName", label: "Match domain name exactly" },
          { key: "version", match: "matchVersion", label: "Match domain version exactly" },
        ] as const
      ).map(({ key, match, label }) => (
        <Controller
          key={key}
          control={control}
          name={`rules.${index}.${match}`}
          render={({ field: matching }) => (
            <Field>
              <Checkbox
                name={matching.name}
                isSelected={matching.value}
                onChange={matching.onChange}
                onBlur={matching.onBlur}
              >
                <Checkbox.Content>
                  <Checkbox.Control ref={matching.ref}>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  {label}
                </Checkbox.Content>
              </Checkbox>
              {matching.value ? (
                <Controller
                  control={control}
                  name={`rules.${index}.${key}`}
                  render={({ field }) => (
                    <Input
                      {...field}
                      aria-label={key === "name" ? "Exact domain name" : "Exact domain version"}
                      autoComplete="off"
                      placeholder="Empty string"
                      variant="secondary"
                    />
                  )}
                />
              ) : null}
            </Field>
          )}
        />
      ))}
    </div>
  );
}
