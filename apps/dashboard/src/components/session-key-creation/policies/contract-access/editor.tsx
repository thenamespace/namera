// oxlint-disable react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-new-array-as-prop
import { useMemo, useState } from "react";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  EvmSessionPermission,
  EthereumAddress,
  type SupportedEvmChainId,
} from "@namera-ai/protocol/evm";
import {
  Button,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  ListBox,
  Select,
  TextArea,
} from "@namera-ai/ui";
import { Controller, useForm, useWatch } from "react-hook-form";

import { catalogInterfaceAtom } from "@/atoms/catalog/interface";
import { EvmFunctionPicker } from "@/components/evm-function-picker";
import { abiFunctionOptions } from "@/components/evm-function-picker/functions";
import type { OnchainPermissionInput } from "@/components/policy/evm/onchain/catalog";
import { toQuery } from "@/hooks/atom";

import { parseContractAbi } from "./abi";
import { ContractAccessForm, contractAccessModes, toContractAccessForm } from "./form";
import { ContractTargetPicker, type ContractTarget } from "./target-picker";

const useCatalogInterface = toQuery(catalogInterfaceAtom);
export type ContractAccessDraft = { target: ContractTarget | null; abi: string };

export function ContractAccessEditor({
  formId,
  chainIds,
  initialValue,
  validatePermission,
  onSave,
  initialDraft,
  onSaveDraft,
}: {
  formId: string;
  chainIds: readonly SupportedEvmChainId[];
  initialValue?: OnchainPermissionInput | undefined;
  validatePermission: (permission: OnchainPermissionInput) => string | undefined;
  onSave: (permission: OnchainPermissionInput) => void;
  initialDraft?: ContractAccessDraft | undefined;
  onSaveDraft: (permission: OnchainPermissionInput, draft: ContractAccessDraft) => void;
}) {
  const form = useForm<typeof ContractAccessForm.Encoded, unknown, typeof ContractAccessForm.Type>({
    defaultValues: { ...toContractAccessForm(initialValue), abi: initialDraft?.abi ?? "" },
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(ContractAccessForm)),
  });
  const type = useWatch({ control: form.control, name: "type" });
  const abiText = useWatch({ control: form.control, name: "abi" });
  const [target, setTarget] = useState<ContractTarget | null>(() =>
    initialDraft
      ? initialDraft.target
      : initialValue && "address" in initialValue
        ? { source: "custom", address: EthereumAddress.make(initialValue.address), abi: "" }
        : null,
  );
  const needsFunctions = type !== "contract-access";
  const interfaceId =
    needsFunctions && type !== "functions-on-all-contracts" && target?.source === "catalog"
      ? target.deployment.interfaceId
      : null;
  const query = useCatalogInterface(interfaceId);
  const localAbi = useMemo(() => parseContractAbi(abiText), [abiText]);
  const abi = interfaceId ? (query.data?.document ?? null) : localAbi;
  const options = useMemo(() => (abi ? abiFunctionOptions(abi) : []), [abi]);
  const submit = form.handleSubmit((permission) => {
    if (
      needsFunctions &&
      (!abi ||
        !("functions" in permission) ||
        permission.functions.some(
          (selector) => !options.some((option) => option.selector === selector),
        ))
    ) {
      form.setError("functions", { message: "Load an ABI and select functions from it." });
      return;
    }
    const encoded = Schema.encodeSync(EvmSessionPermission)(permission);
    const conflict = validatePermission(encoded);
    if (conflict) {
      form.setError("root", { message: conflict });
      return;
    }
    onSaveDraft(encoded, { target, abi: form.getValues("abi") });
    onSave(encoded);
  });

  return (
    <form
      id={formId}
      noValidate
      onSubmit={(event) => {
        event.stopPropagation();
        void submit(event);
      }}
    >
      <FieldGroup>
        <FieldError errors={[form.formState.errors.root]} />
        <Controller
          control={form.control}
          name="type"
          render={({ field }) => (
            <Field>
              <FieldLabel id={`${formId}-mode`}>Access type</FieldLabel>
              <Select
                aria-labelledby={`${formId}-mode`}
                fullWidth
                variant="secondary"
                name={field.name}
                selectedKey={field.value}
                onSelectionChange={(key) => {
                  if (key === field.value) return;
                  field.onChange(key);
                  form.setValue("functions", "");
                  form.clearErrors();
                  form.setValue(
                    "abi",
                    key !== "functions-on-all-contracts" && target?.source === "custom"
                      ? target.abi
                      : "",
                  );
                }}
              >
                <Select.Trigger ref={field.ref} onBlur={field.onBlur}>
                  <Select.Value>
                    {contractAccessModes.find((mode) => mode.id === field.value)?.name}
                  </Select.Value>
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover className="w-(--trigger-width)">
                  <ListBox items={contractAccessModes}>
                    {(mode) => (
                      <ListBox.Item id={mode.id} textValue={mode.name}>
                        {mode.name}
                      </ListBox.Item>
                    )}
                  </ListBox>
                </Select.Popover>
              </Select>
            </Field>
          )}
        />
        {type !== "functions-on-all-contracts" ? (
          <Controller
            control={form.control}
            name="address"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`${formId}-address`}>Contract address</FieldLabel>
                <ContractTargetPicker
                  id={`${formId}-address`}
                  label="Select token or contract"
                  chainIds={chainIds}
                  value={target}
                  requireAbi={needsFunctions}
                  onBlur={field.onBlur}
                  isInvalid={fieldState.invalid}
                  popoverClassName="border border-separator"
                  onChange={(next) => {
                    setTarget(next);
                    field.onChange(
                      next.source === "catalog" ? next.deployment.address : next.address,
                    );
                    form.setValue("abi", next.source === "custom" ? next.abi : "");
                    form.setValue("functions", "");
                    form.clearErrors();
                  }}
                />
                <FieldError>
                  {fieldState.error ? "Choose a contract address." : undefined}
                </FieldError>
              </Field>
            )}
          />
        ) : null}
        {needsFunctions &&
        !interfaceId &&
        (type === "functions-on-all-contracts" || target?.source !== "custom" || !target.abi) ? (
          <Controller
            control={form.control}
            name="abi"
            render={({ field }) => (
              <Field data-invalid={Boolean(abiText && !localAbi)}>
                <FieldLabel htmlFor={`${formId}-abi`}>Contract ABI</FieldLabel>
                <TextArea
                  {...field}
                  id={`${formId}-abi`}
                  rows={5}
                  variant="secondary"
                  placeholder="Paste JSON ABI"
                  spellCheck={false}
                  onChange={(event) => {
                    field.onChange(event);
                    form.setValue("functions", "");
                  }}
                />
                <FieldError>
                  {abiText && !localAbi
                    ? "Enter a valid JSON ABI containing functions."
                    : undefined}
                </FieldError>
              </Field>
            )}
          />
        ) : null}
        {needsFunctions && interfaceId && query.isPending ? (
          <output className="text-muted text-xs">Loading contract ABI…</output>
        ) : null}
        {needsFunctions && interfaceId && query.isError ? (
          <div className="flex items-center gap-2 text-danger text-xs">
            Couldn’t load contract ABI.
            <Button size="sm" variant="tertiary" onPress={query.refetch}>
              Retry
            </Button>
          </div>
        ) : null}
        {needsFunctions ? (
          <Controller
            control={form.control}
            name="functions"
            render={({ field, fieldState }) => {
              const selectors = new Set(field.value.split(/[\n,]/).filter(Boolean));
              return (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`${formId}-functions`}>Allowed functions</FieldLabel>
                  <EvmFunctionPicker
                    id={`${formId}-functions`}
                    abi={abi ?? []}
                    selectionMode="multiple"
                    isDisabled={!abi}
                    isInvalid={fieldState.invalid}
                    triggerRef={field.ref}
                    onBlur={field.onBlur}
                    value={options
                      .filter((option) => selectors.has(option.selector))
                      .map((option) => option.signature)}
                    onChange={(signatures) =>
                      field.onChange(
                        [
                          ...new Set(
                            options
                              .filter((option) => signatures.includes(option.signature))
                              .map((option) => option.selector),
                          ),
                        ].join("\n"),
                      )
                    }
                  />
                  <FieldError>
                    {fieldState.error
                      ? "Load an ABI and select at least one allowed function."
                      : undefined}
                  </FieldError>
                </Field>
              );
            }}
          />
        ) : null}
      </FieldGroup>
    </form>
  );
}
