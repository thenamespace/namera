import type { FormEvent } from "react";

// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import type { EvmNativeSpendLimitPeriod } from "@namera-ai/protocol";
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
import { Add01Icon, Delete02Icon, HugeiconsIcon } from "@namera-ai/ui/icons";
import { Controller, useFieldArray, useForm, useWatch, type Control } from "react-hook-form";
import { useEventCallback } from "usehooks-ts";
import { formatUnits, parseUnits } from "viem";

import {
  evmChainById,
  evmChainOptions,
  evmPolicyFormIds,
  nativeSpendPeriodById,
  nativeSpendPeriodOptions,
} from "./data";
import { EvmNetworkMultiSelect } from "./network-multi-select";
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
      period: Schema.Literals(nativeSpendPeriodOptions.map((period) => period.id)),
      amount: NativeAmount,
    }),
  ).check(Schema.isMinLength(1, { message: "Add at least one network limit" })),
});

const validNativeSpendLimits = Schema.makeFilter<typeof NativeSpendLimitFormFields.Type>(
  (value) => {
    const firstLimitByChainPeriod = new Map<string, number>();

    for (const [index, limit] of value.limits.entries()) {
      for (const chainId of limit.chainIds) {
        const key = `${chainId}:${limit.period}`;
        const firstIndex = firstLimitByChainPeriod.get(key);
        if (firstIndex !== undefined) {
          const chainName = evmChainById.get(chainId)?.name ?? "This network";
          const periodName = nativeSpendPeriodById.get(limit.period)?.label ?? limit.period;
          return {
            path: ["limits", index, "chainIds"],
            issue: `${chainName} already has a ${periodName.toLowerCase()} limit in limit ${firstIndex + 1}`,
          };
        }
        firstLimitByChainPeriod.set(key, index);
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
  limits: [{ chainIds: [defaultChain.id], period: "lifetime", amount: "" }],
};

const toFormValue = (policy: NativeSpendLimitPolicyInput): NativeSpendLimitFormInput => {
  const groupedLimits = new Map<
    string,
    {
      amount: string;
      chainIds: Array<SupportedEvmChainId>;
      period: EvmNativeSpendLimitPeriod;
    }
  >();

  for (const limit of policy.limits) {
    const chain = evmChainById.get(limit.chainId);
    const amount = formatUnits(BigInt(limit.maxAmount), chain?.nativeCurrency.decimals ?? 18);
    const groupKey = `${limit.period}:${amount}`;
    const existing = groupedLimits.get(groupKey);
    if (existing) {
      existing.chainIds.push(limit.chainId);
    } else {
      groupedLimits.set(groupKey, { amount, chainIds: [limit.chainId], period: limit.period });
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
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel id={`native-spend-network-${index}`}>Networks</FieldLabel>
            <EvmNetworkMultiSelect
              aria-labelledby={`native-spend-network-${index}`}
              isInvalid={fieldState.invalid}
              name={field.name}
              triggerRef={field.ref}
              value={field.value as ReadonlyArray<SupportedEvmChainId>}
              onBlur={field.onBlur}
              onChange={field.onChange}
            />
            {fieldState.error ? (
              <Typography.Paragraph className="text-danger" role="alert" size="xs">
                {fieldState.error.message ?? "Select a supported network"}
              </Typography.Paragraph>
            ) : null}
          </Field>
        )}
      />

      <Controller
        control={control}
        name={`limits.${index}.period`}
        render={({ field, fieldState }) => {
          const selectedPeriod = nativeSpendPeriodById.get(field.value);

          return (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel id={`native-spend-period-${index}`}>Allowance period</FieldLabel>
              <Select
                aria-labelledby={`native-spend-period-${index}`}
                fullWidth
                isInvalid={fieldState.invalid}
                name={field.name}
                selectedKey={field.value}
                variant="secondary"
                onSelectionChange={(key) =>
                  field.onChange(String(key) as EvmNativeSpendLimitPeriod)
                }
              >
                <Select.Trigger onBlur={field.onBlur} ref={field.ref}>
                  <Select.Value>{selectedPeriod?.label ?? "Select a period"}</Select.Value>
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox items={nativeSpendPeriodOptions}>
                    {(period) => (
                      <ListBox.Item id={period.id} textValue={period.label}>
                        <div className="grid min-w-0 gap-0.5">
                          <span>{period.label}</span>
                          <span className="text-muted text-xs">{period.description}</span>
                        </div>
                      </ListBox.Item>
                    )}
                  </ListBox>
                </Select.Popover>
              </Select>
              <Typography.Paragraph color="muted" size="xs">
                {selectedPeriod?.description ?? "Choose when this allowance resets."}
              </Typography.Paragraph>
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
              <FieldLabel htmlFor={`native-spend-amount-${index}`}>Native allowance</FieldLabel>
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
  const selectedChainPeriods = new Set(
    limits.flatMap((limit) => limit.chainIds.map((chainId) => `${chainId}:${limit.period}`)),
  );
  const availableCombination = nativeSpendPeriodOptions
    .flatMap((period) => evmChainOptions.map((chain) => ({ chain, period })))
    .find(({ chain, period }) => !selectedChainPeriods.has(`${chain.id}:${period.id}`));
  const handleAdd = useEventCallback(() => {
    if (!availableCombination) return;
    limitFields.append(
      {
        chainIds: [availableCombination.chain.id],
        period: availableCombination.period.id,
        amount: "",
      },
      { shouldFocus: false },
    );
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
            period: limit.period,
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
            isDisabled={!availableCombination}
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
