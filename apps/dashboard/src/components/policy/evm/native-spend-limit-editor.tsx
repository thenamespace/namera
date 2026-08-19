import type { FormEvent } from "react";

// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import type { SupportedEvmChainId } from "@namera-ai/protocol/evm";
import {
  Button,
  Field,
  FieldGroup,
  FieldLabel,
  InputGroup,
  ListBox,
  Select,
  Typography,
} from "@namera-ai/ui";
import { Add01Icon, ChainIcon, Delete02Icon, HugeiconsIcon } from "@namera-ai/ui/icons";
import { Controller, useFieldArray, useForm, useWatch, type Control } from "react-hook-form";
import { useEventCallback } from "usehooks-ts";
import { formatUnits, parseUnits } from "viem";

import { evmChainById, evmChainOptions, evmPolicyFormIds } from "./data";
import type { EvmPolicyInput, NativeSpendLimitPolicyInput } from "./types";

const NativeAmount = Schema.String.check(
  Schema.isPattern(/^(?:0|[1-9]\d*)(?:\.\d+)?$/, {
    message: "Enter a valid native-token amount",
  }),
);

const NativeSpendLimitFormFields = Schema.Struct({
  limits: Schema.Array(
    Schema.Struct({
      chainIds: Schema.Array(Schema.Literals(evmChainOptions.map((chain) => chain.id))).check(
        Schema.isMinLength(1, { message: "Select at least one network" }),
      ),
      amount: NativeAmount,
    }),
  ).check(Schema.isMinLength(1, { message: "Add at least one network limit" })),
});

const validNativeSpendLimits = Schema.makeFilter<typeof NativeSpendLimitFormFields.Type>(
  (value) => {
    const firstLimitByChain = new Map<SupportedEvmChainId, number>();

    for (const [index, limit] of value.limits.entries()) {
      for (const chainId of limit.chainIds) {
        const firstIndex = firstLimitByChain.get(chainId);
        if (firstIndex !== undefined) {
          const chainName = evmChainById.get(chainId)?.name ?? "This network";
          return {
            path: ["limits", index, "chainIds"],
            issue: `${chainName} is already selected in limit ${firstIndex + 1}`,
          };
        }
        firstLimitByChain.set(chainId, index);
      }

      const decimals = Math.min(
        ...limit.chainIds.map(
          (chainId) => evmChainById.get(chainId)?.nativeCurrency.decimals ?? 18,
        ),
      );
      const fractionalDigits = limit.amount.split(".")[1]?.length ?? 0;
      if (fractionalDigits > decimals) {
        return {
          path: ["limits", index, "amount"],
          issue: `Use no more than ${decimals} decimal places`,
        };
      }
    }

    return undefined;
  },
);

const NativeSpendLimitForm = NativeSpendLimitFormFields.check(validNativeSpendLimits);

type NativeSpendLimitFormInput = typeof NativeSpendLimitForm.Encoded;
type NativeSpendLimitFormValues = typeof NativeSpendLimitForm.Type;

const defaultChain = evmChainOptions.find((chain) => chain.id === "eip155:1") ?? evmChainOptions[0];
if (!defaultChain) throw new Error("At least one supported EVM chain is required");

const emptyNativeSpendLimit: NativeSpendLimitFormInput = {
  limits: [{ chainIds: [defaultChain.id], amount: "" }],
};

const toFormValue = (policy: NativeSpendLimitPolicyInput): NativeSpendLimitFormInput => {
  const groupedLimits = new Map<string, { amount: string; chainIds: Array<SupportedEvmChainId> }>();

  for (const limit of policy.limits) {
    const chain = evmChainById.get(limit.chainId);
    const amount = formatUnits(BigInt(limit.maxAmount), chain?.nativeCurrency.decimals ?? 18);
    const existing = groupedLimits.get(amount);
    if (existing) {
      existing.chainIds.push(limit.chainId);
    } else {
      groupedLimits.set(amount, { amount, chainIds: [limit.chainId] });
    }
  }

  return { limits: [...groupedLimits.values()] };
};

type NativeSpendLimitRowProps = {
  canRemove: boolean;
  control: Control<NativeSpendLimitFormInput, unknown, NativeSpendLimitFormValues>;
  index: number;
  onRemove: (index: number) => void;
};

function NativeSpendLimitRow({ canRemove, control, index, onRemove }: NativeSpendLimitRowProps) {
  const chainIds = useWatch({ control, name: `limits.${index}.chainIds` });
  const selectedChains = chainIds.flatMap((chainId) => {
    const chain = evmChainById.get(chainId);
    return chain ? [chain] : [];
  });
  const handleRemove = useEventCallback(() => onRemove(index));

  return (
    <div className="border-separator bg-surface/40 grid gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <Typography.Paragraph color="muted" size="xs">
          Limit {index + 1}
        </Typography.Paragraph>
        <Button
          isIconOnly
          aria-label={`Remove limit ${index + 1}`}
          isDisabled={!canRemove}
          size="sm"
          type="button"
          variant="tertiary"
          onPress={handleRemove}
        >
          <HugeiconsIcon icon={Delete02Icon} />
        </Button>
      </div>

      <Controller
        control={control}
        name={`limits.${index}.chainIds`}
        render={({ field, fieldState }) => {
          const error = fieldState.error;

          return (
            <Field data-invalid={Boolean(error)}>
              <FieldLabel id={`native-spend-network-${index}`}>Networks</FieldLabel>
              <Select<(typeof evmChainOptions)[number], "multiple">
                aria-labelledby={`native-spend-network-${index}`}
                fullWidth
                isInvalid={Boolean(error)}
                name={field.name}
                selectionMode="multiple"
                value={Array.from(field.value)}
                variant="secondary"
                onChange={(keys) =>
                  field.onChange(keys.map((key) => String(key) as SupportedEvmChainId))
                }
              >
                <Select.Trigger onBlur={field.onBlur} ref={field.ref}>
                  <Select.Value>
                    {selectedChains[0] ? (
                      <span className="flex items-center gap-2">
                        <ChainIcon
                          aria-hidden
                          chain={selectedChains[0].chain}
                          className="size-4"
                          namespace="eip155"
                        />
                        <span className="truncate">
                          {selectedChains.length === 1
                            ? selectedChains[0].name
                            : `${selectedChains.length} networks`}
                        </span>
                      </span>
                    ) : (
                      "Select networks"
                    )}
                  </Select.Value>
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover className="w-(--trigger-width)">
                  <ListBox items={evmChainOptions}>
                    {(chain) => (
                      <ListBox.Item id={chain.id} textValue={chain.name}>
                        <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
                          <span className="flex min-w-0 items-center gap-2">
                            <ChainIcon
                              aria-hidden
                              chain={chain.chain}
                              className="size-4 shrink-0"
                              namespace="eip155"
                            />
                            <span className="truncate">{chain.name}</span>
                          </span>
                          <span className="text-muted shrink-0 text-xs">
                            {chain.nativeCurrency.symbol}
                          </span>
                        </div>
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    )}
                  </ListBox>
                </Select.Popover>
              </Select>
              {error ? (
                <Typography.Paragraph className="text-danger" role="alert" size="xs">
                  {error.message ?? "Select a supported network"}
                </Typography.Paragraph>
              ) : null}
            </Field>
          );
        }}
      />

      <Controller
        control={control}
        name={`limits.${index}.amount`}
        render={({ field, fieldState }) => {
          const error = fieldState.error;

          return (
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor={`native-spend-amount-${index}`}>Lifetime allowance</FieldLabel>
              <InputGroup fullWidth variant="secondary">
                <InputGroup.Input
                  {...field}
                  id={`native-spend-amount-${index}`}
                  aria-invalid={Boolean(error)}
                  autoComplete="off"
                  inputMode="decimal"
                  placeholder="0.00"
                />
                <InputGroup.Suffix>
                  <span className="text-muted text-xs">Native</span>
                </InputGroup.Suffix>
              </InputGroup>
              {error ? (
                <Typography.Paragraph className="text-danger" role="alert" size="xs">
                  {error.message ?? "Enter a valid native-token amount"}
                </Typography.Paragraph>
              ) : null}
            </Field>
          );
        }}
      />
    </div>
  );
}

type NativeSpendLimitPolicyEditorProps = {
  formId?: string;
  initialValue?: NativeSpendLimitPolicyInput;
  onSave: (policy: EvmPolicyInput) => void;
};

export function NativeSpendLimitPolicyEditor({
  formId = evmPolicyFormIds["evm.native-spend-limit"],
  initialValue,
  onSave,
}: NativeSpendLimitPolicyEditorProps) {
  const form = useForm<NativeSpendLimitFormInput, unknown, NativeSpendLimitFormValues>({
    defaultValues: initialValue ? toFormValue(initialValue) : emptyNativeSpendLimit,
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(NativeSpendLimitForm)),
  });
  const limitFields = useFieldArray({ control: form.control, name: "limits" });
  const limits = useWatch({ control: form.control, name: "limits" });
  const selectedChainIds = new Set(limits.flatMap((limit) => limit.chainIds));
  const availableChain = evmChainOptions.find((chain) => !selectedChainIds.has(chain.id));
  const handleAdd = useEventCallback(() => {
    if (!availableChain) return;
    limitFields.append({ chainIds: [availableChain.id], amount: "" }, { shouldFocus: false });
  });
  const handleRemove = useEventCallback((index: number) => {
    if (limitFields.fields.length === 1) return;
    limitFields.remove(index);
  });
  const submitPolicy = form.handleSubmit((value) => {
    const policy: NativeSpendLimitPolicyInput = {
      type: "evm.native-spend-limit",
      version: 1,
      limits: value.limits.flatMap((limit) =>
        limit.chainIds.map((chainId) => {
          const chain = evmChainById.get(chainId);
          return {
            chainId,
            maxAmount: parseUnits(limit.amount, chain?.nativeCurrency.decimals ?? 18).toString(),
          };
        }),
      ),
    };
    onSave(policy);
  });
  const handleSubmit = useEventCallback((event: FormEvent<HTMLFormElement>) => {
    event.stopPropagation();
    void submitPolicy(event);
  });

  return (
    <form id={formId} noValidate onSubmit={handleSubmit}>
      <FieldGroup>
        <div className="grid gap-2">
          {limitFields.fields.map((field, index) => (
            <NativeSpendLimitRow
              canRemove={limitFields.fields.length > 1}
              control={form.control}
              index={index}
              key={field.id}
              onRemove={handleRemove}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-4">
          <Typography.Paragraph color="muted" size="xs">
            Networks not listed can still make zero-value contract calls.
          </Typography.Paragraph>
          <Button
            isDisabled={!availableChain}
            size="sm"
            type="button"
            variant="tertiary"
            onPress={handleAdd}
          >
            <HugeiconsIcon icon={Add01Icon} />
            Add another limit
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
