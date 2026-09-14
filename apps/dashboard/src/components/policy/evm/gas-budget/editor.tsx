import type { FormEvent } from "react";

// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import type { EvmGasBudgetPeriod } from "@namera-ai/protocol";
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
  gasBudgetPeriodById,
  gasBudgetPeriodOptions,
} from "../data";
import { EvmNetworkMultiSelect } from "../network-multi-select";
import type { EvmPolicyInput, GasBudgetPolicyInput } from "../types";

const NativeAmount = Schema.String.check(
  Schema.isPattern(/^(?:0|[1-9]\d*)(?:\.\d+)?$/, {
    message: "Enter a valid native-token amount",
  }),
);

const GasBudgetFormFields = Schema.Struct({
  budgets: Schema.Array(
    Schema.Struct({
      chainIds: Schema.Array(Schema.Literals(evmChainOptions.map((chain) => chain.id))).check(
        Schema.isMinLength(1, { message: "Select at least one network" }),
      ),
      period: Schema.Literals(gasBudgetPeriodOptions.map((period) => period.id)),
      amount: NativeAmount,
    }),
  ).check(Schema.isMinLength(1, { message: "Add at least one gas budget" })),
});

const validGasBudgets = Schema.makeFilter<typeof GasBudgetFormFields.Type>((value) => {
  const firstBudgetByChainPeriod = new Map<string, number>();

  for (const [index, budget] of value.budgets.entries()) {
    for (const chainId of budget.chainIds) {
      const key = `${chainId}:${budget.period}`;
      const firstIndex = firstBudgetByChainPeriod.get(key);
      if (firstIndex !== undefined) {
        const chainName = evmChainById.get(chainId)?.name ?? "This network";
        const periodName = gasBudgetPeriodById.get(budget.period)?.label ?? budget.period;
        return {
          path: ["budgets", index, "chainIds"],
          issue: `${chainName} already has a ${periodName.toLowerCase()} budget in budget ${firstIndex + 1}`,
        };
      }
      firstBudgetByChainPeriod.set(key, index);
    }

    const decimals = Math.min(
      ...budget.chainIds.map((chainId) => evmChainById.get(chainId)?.nativeCurrency.decimals ?? 18),
    );
    const fractionalDigits = budget.amount.split(".")[1]?.length ?? 0;
    if (fractionalDigits > decimals) {
      return {
        path: ["budgets", index, "amount"],
        issue: `Use no more than ${decimals} decimal places`,
      };
    }
  }

  return undefined;
});

const GasBudgetForm = GasBudgetFormFields.check(validGasBudgets);

type GasBudgetFormInput = typeof GasBudgetForm.Encoded;
type GasBudgetFormValues = typeof GasBudgetForm.Type;

const defaultChainId =
  evmChainOptions.find((chain) => chain.id === "eip155:1")?.id ?? evmChainOptions[0]?.id;
if (!defaultChainId) throw new Error("At least one supported EVM chain is required");

const emptyGasBudget: GasBudgetFormInput = {
  budgets: [{ chainIds: [defaultChainId], period: "day", amount: "" }],
};

const toFormValue = (policy: GasBudgetPolicyInput): GasBudgetFormInput => {
  const groupedBudgets = new Map<
    string,
    {
      amount: string;
      chainIds: Array<SupportedEvmChainId>;
      period: EvmGasBudgetPeriod;
    }
  >();

  for (const budget of policy.budgets) {
    const chain = evmChainById.get(budget.chainId);
    const amount = formatUnits(BigInt(budget.maxCost), chain?.nativeCurrency.decimals ?? 18);
    const groupKey = `${budget.period}:${amount}`;
    const existing = groupedBudgets.get(groupKey);
    if (existing) {
      existing.chainIds.push(budget.chainId);
    } else {
      groupedBudgets.set(groupKey, {
        amount,
        chainIds: [budget.chainId],
        period: budget.period,
      });
    }
  }

  return { budgets: [...groupedBudgets.values()] };
};

type GasBudgetRowProps = {
  canRemove: boolean;
  control: Control<GasBudgetFormInput, unknown, GasBudgetFormValues>;
  index: number;
  onRemove: (index: number) => void;
};

function GasBudgetRow({ canRemove, control, index, onRemove }: GasBudgetRowProps) {
  const handleRemove = useEventCallback(() => onRemove(index));

  return (
    <div className="border-separator bg-surface/40 grid gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <Typography.Paragraph color="muted" size="xs">
          Budget {index + 1}
        </Typography.Paragraph>
        <Button
          isIconOnly
          aria-label={`Remove budget ${index + 1}`}
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
        name={`budgets.${index}.chainIds`}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel id={`gas-budget-networks-${index}`}>Networks</FieldLabel>
            <EvmNetworkMultiSelect
              aria-labelledby={`gas-budget-networks-${index}`}
              isInvalid={fieldState.invalid}
              name={field.name}
              triggerRef={field.ref}
              value={field.value as ReadonlyArray<SupportedEvmChainId>}
              onBlur={field.onBlur}
              onChange={field.onChange}
            />
            {fieldState.error ? (
              <Typography.Paragraph className="text-danger" role="alert" size="xs">
                {fieldState.error.message ?? "Select at least one network"}
              </Typography.Paragraph>
            ) : null}
          </Field>
        )}
      />

      <Controller
        control={control}
        name={`budgets.${index}.period`}
        render={({ field, fieldState }) => {
          const selectedPeriod = gasBudgetPeriodById.get(field.value);

          return (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel id={`gas-budget-period-${index}`}>Budget period</FieldLabel>
              <Select
                aria-labelledby={`gas-budget-period-${index}`}
                fullWidth
                isInvalid={fieldState.invalid}
                name={field.name}
                selectedKey={field.value}
                variant="secondary"
                onSelectionChange={(key) => field.onChange(String(key) as EvmGasBudgetPeriod)}
              >
                <Select.Trigger onBlur={field.onBlur} ref={field.ref}>
                  <Select.Value>{selectedPeriod?.label ?? "Select a period"}</Select.Value>
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox items={gasBudgetPeriodOptions}>
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
                {selectedPeriod?.description ?? "Choose when this budget resets."}
              </Typography.Paragraph>
            </Field>
          );
        }}
      />

      <Controller
        control={control}
        name={`budgets.${index}.amount`}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={`gas-budget-amount-${index}`}>Maximum gas cost</FieldLabel>
            <InputGroup fullWidth variant="secondary">
              <InputGroup.Input
                {...field}
                id={`gas-budget-amount-${index}`}
                aria-invalid={fieldState.invalid}
                autoComplete="off"
                inputMode="decimal"
                placeholder="0.00"
              />
              <InputGroup.Suffix>
                <span className="text-muted text-xs">Native</span>
              </InputGroup.Suffix>
            </InputGroup>
            {fieldState.error ? (
              <Typography.Paragraph className="text-danger" role="alert" size="xs">
                {fieldState.error.message ?? "Enter a valid native-token amount"}
              </Typography.Paragraph>
            ) : null}
          </Field>
        )}
      />
    </div>
  );
}

type GasBudgetPolicyEditorProps = {
  formId?: string;
  initialValue?: GasBudgetPolicyInput;
  onSave: (policy: EvmPolicyInput) => void;
};

export function GasBudgetPolicyEditor({
  formId = evmPolicyFormIds["evm.gas-budget"],
  initialValue,
  onSave,
}: GasBudgetPolicyEditorProps) {
  const form = useForm<GasBudgetFormInput, unknown, GasBudgetFormValues>({
    defaultValues: initialValue ? toFormValue(initialValue) : emptyGasBudget,
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(GasBudgetForm)),
  });
  const budgetFields = useFieldArray({ control: form.control, name: "budgets" });
  const budgets = useWatch({ control: form.control, name: "budgets" });
  const selectedChainPeriods = new Set(
    budgets.flatMap((budget) => budget.chainIds.map((chainId) => `${chainId}:${budget.period}`)),
  );
  const availableCombination = gasBudgetPeriodOptions
    .flatMap((period) => evmChainOptions.map((chain) => ({ chain, period })))
    .find(({ chain, period }) => !selectedChainPeriods.has(`${chain.id}:${period.id}`));
  const handleAdd = useEventCallback(() => {
    if (!availableCombination) return;
    budgetFields.append(
      {
        chainIds: [availableCombination.chain.id],
        period: availableCombination.period.id,
        amount: "",
      },
      { shouldFocus: false },
    );
  });
  const handleRemove = useEventCallback((index: number) => {
    if (budgetFields.fields.length === 1) return;
    budgetFields.remove(index);
  });
  const submitPolicy = form.handleSubmit((value) => {
    onSave({
      type: "evm.gas-budget",
      version: 1,
      budgets: value.budgets.flatMap((budget) =>
        budget.chainIds.map((chainId) => ({
          chainId,
          period: budget.period,
          maxCost: parseUnits(
            budget.amount,
            evmChainById.get(chainId)?.nativeCurrency.decimals ?? 18,
          ).toString(),
        })),
      ),
    });
  });
  const handleSubmit = useEventCallback((event: FormEvent<HTMLFormElement>) => {
    event.stopPropagation();
    void submitPolicy(event);
  });

  return (
    <form id={formId} noValidate onSubmit={handleSubmit}>
      <FieldGroup>
        <div className="grid gap-2">
          {budgetFields.fields.map((field, index) => (
            <GasBudgetRow
              canRemove={budgetFields.fields.length > 1}
              control={form.control}
              index={index}
              key={field.id}
              onRemove={handleRemove}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-4">
          <Typography.Paragraph color="muted" size="xs">
            Executions are denied on networks without a gas budget.
          </Typography.Paragraph>
          <Button
            isDisabled={!availableCombination}
            size="sm"
            type="button"
            variant="tertiary"
            onPress={handleAdd}
          >
            <HugeiconsIcon icon={Add01Icon} />
            Add another budget
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
