// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useId, useMemo, useState } from "react";

import { DateTime, Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { CreateEvmSessionKeyRequest, type ListWalletsResponse } from "@namera-ai/protocol/dto";
import type { Template, RegisteredTemplate } from "@namera-ai/templates";
import {
  Button,
  Checkbox,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  InputGroup,
  Tooltip,
  Typography,
} from "@namera-ai/ui";
import { HugeiconsIcon, InformationCircleIcon } from "@namera-ai/ui/icons";
import { Controller, useForm, useWatch, type UseFormReturn } from "react-hook-form";

import {
  DashboardCardRoot,
  DashboardCardContent,
  DashboardCardRow,
} from "@/components/dashboard-card";
import { HeadingGroup } from "@/components/heading-group";
import { DateTimePolicyField } from "@/components/policy/evm/date-time-policy-field";
import { EvmNetworkMultiSelect } from "@/components/policy/evm/network-multi-select";
import { isChainOperationEnabled } from "@/lib/chain-availability";
import { showErrorToast } from "@/lib/toasts";

import type { CustodyLimits } from "./custody-field";
import { SessionKeyDetailsCard } from "./details-card";
import { subregistryInputError } from "./subregistry-review";
import { TemplateNetworkSelect } from "./template-network-select";
import { TemplateTokenSelect } from "./template-token-select";
import type { CreateSessionKeyFormInput, CreateSessionKeyFormValues } from "./types";

type TemplateInput = RegisteredTemplate["inputSchema"]["Encoded"];
type FormTemplate = Omit<Template<Schema.Codec<TemplateInput>>, "build"> &
  Pick<RegisteredTemplate, "build">;
const emptyNetworks: readonly never[] = [];
const futureExpiry = Schema.makeFilter((input: TemplateInput) =>
  DateTime.toEpochMillis(DateTime.makeUnsafe(input.expiresAt)) > Date.now()
    ? undefined
    : { path: ["expiresAt"], issue: "Choose an expiry date in the future." },
);

export function TemplateCreationForm({
  template: selectedTemplate,
  metadataForm,
  wallets,
  limits,
  custodyLocked,
  disabled,
  onCreate,
}: {
  template: FormTemplate;
  metadataForm: UseFormReturn<CreateSessionKeyFormInput, unknown, CreateSessionKeyFormValues>;
  wallets: ListWalletsResponse;
  limits: CustodyLimits;
  custodyLocked: boolean;
  disabled: boolean;
  onCreate: (values: CreateSessionKeyFormValues) => void;
}) {
  // The resolver validates against this definition's schema before calling its builder.
  // Widen the registry union locally; each exported builder keeps its typed input API.
  const template = selectedTemplate as Template<Schema.Codec<TemplateInput>>;
  const id = useId();
  const [step, setStep] = useState<"details" | "configuration">("details");
  const schema = useMemo(() => {
    const inputSchema: Schema.Codec<TemplateInput> = template.inputSchema;

    return inputSchema.check(
      futureExpiry,
      Schema.makeFilter((input) =>
        input.networks.every(isChainOperationEnabled)
          ? undefined
          : {
              path: ["networks"],
              issue: "Choose networks that are not paused.",
            },
      ),
    );
  }, [template]);
  const form = useForm<TemplateInput>({
    defaultValues: template.defaults,
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(schema)),
    mode: "onChange",
  });
  const configurationDisabled = disabled || form.formState.isSubmitting;
  const inputs: Readonly<Record<string, unknown>> = useWatch({ control: form.control });
  const showApprovalNote =
    template.approvalNote &&
    (!template.approvalNoteWhen || template.approvalNoteWhen.some((name) => inputs[name] === true));

  return (
    <form
      id={id}
      noValidate
      aria-busy={form.formState.isSubmitting}
      className="grid gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (configurationDisabled) return;
        if (step === "details") {
          void metadataForm
            .trigger(["metadata", "walletId", "custody"], { shouldFocus: true })
            .then((valid) => {
              if (valid) setStep("configuration");
              return valid;
            });
          return;
        }
        void form
          .handleSubmit(async (input) => {
            if (template.id === "ens-subname-issuer" && "subregistryAddress" in input) {
              const selectedWallet = wallets.find(
                (wallet) => wallet.id === metadataForm.getValues("walletId"),
              );
              const chainId = input.networks[0];
              if (!selectedWallet || selectedWallet.namespace !== "eip155" || !chainId) {
                setStep("details");
                return;
              }

              let reviewError: string | undefined;
              try {
                reviewError = await subregistryInputError({
                  chainId,
                  registry: input.subregistryAddress as `0x${string}`,
                  account: selectedWallet.address,
                });
              } catch {
                reviewError = "Couldn’t check this registry. Check your connection and try again.";
              }
              if (reviewError) {
                form.setError(
                  "subregistryAddress",
                  { type: "validate", message: reviewError },
                  { shouldFocus: true },
                );
                return;
              }
            }

            const generated = template.build(input, { now: Math.floor(Date.now() / 1000) });
            metadataForm.setValue(
              "onchain",
              Schema.encodeSync(CreateEvmSessionKeyRequest.fields.onchain)(generated.onchain),
            );
            metadataForm.setValue(
              "policies",
              Schema.encodeSync(CreateEvmSessionKeyRequest.fields.policies)(generated.policies),
            );
            await metadataForm.handleSubmit(onCreate, (errors) => {
              if (errors.metadata || errors.walletId || errors.custody) setStep("details");
            })();
          })(event)
          .catch((error) =>
            showErrorToast(error, {
              title: "Couldn’t prepare session key",
              description: "Review the template inputs and try again.",
            }),
          );
      }}
    >
      {step === "details" ? (
        <section className="grid gap-4">
          <HeadingGroup.Title size="sm">Metadata</HeadingGroup.Title>
          <SessionKeyDetailsCard
            form={metadataForm}
            wallets={wallets}
            limits={limits}
            custodyLocked={custodyLocked}
          />
        </section>
      ) : (
        <section className="grid gap-4" aria-labelledby={`${id}-configuration`}>
          <HeadingGroup.Title id={`${id}-configuration`} size="sm">
            Configuration
          </HeadingGroup.Title>
          <DashboardCardRoot>
            <DashboardCardContent>
              <FieldGroup className="contents divide-y divide-separator">
                {template.fields.map((definition) => (
                  <Controller
                    key={definition.name}
                    name={definition.name}
                    control={form.control}
                    render={({ field, fieldState }) => {
                      const fieldId = `${id}-${definition.name}`;
                      return (
                        <DashboardCardRow
                          className={
                            definition.kind === "checkbox"
                              ? "grid-cols-[minmax(0,1fr)_auto]"
                              : undefined
                          }
                        >
                          <Field className="contents" data-invalid={fieldState.invalid}>
                            <div className="flex items-center gap-1">
                              <FieldLabel
                                id={`${fieldId}-label`}
                                htmlFor={fieldId}
                                isRequired={definition.kind !== "checkbox"}
                              >
                                {definition.label}
                              </FieldLabel>
                              {"tooltip" in definition && typeof definition.tooltip === "string" ? (
                                <Tooltip delay={0}>
                                  <Tooltip.Trigger
                                    className="inline-flex size-4 shrink-0 items-center justify-center text-muted"
                                    aria-label={`${definition.label} information`}
                                  >
                                    <HugeiconsIcon
                                      icon={InformationCircleIcon}
                                      className="size-3.5"
                                      aria-hidden
                                    />
                                  </Tooltip.Trigger>
                                  <Tooltip.Content className="max-w-xs">
                                    {definition.tooltip}
                                  </Tooltip.Content>
                                </Tooltip>
                              ) : null}
                            </div>
                            <div className="grid w-full min-w-0 gap-2">
                              {definition.kind === "checkbox" ? (
                                <Checkbox
                                  className="justify-self-end"
                                  id={fieldId}
                                  aria-labelledby={`${fieldId}-label`}
                                  aria-describedby={`${fieldId}-feedback`}
                                  name={field.name}
                                  isSelected={field.value === true}
                                  onChange={field.onChange}
                                  onBlur={field.onBlur}
                                  ref={field.ref}
                                  isInvalid={fieldState.invalid}
                                  isDisabled={configurationDisabled}
                                >
                                  <Checkbox.Content>
                                    <Checkbox.Control>
                                      <Checkbox.Indicator />
                                    </Checkbox.Control>
                                  </Checkbox.Content>
                                </Checkbox>
                              ) : definition.kind === "networks" ? (
                                <EvmNetworkMultiSelect
                                  aria-labelledby={`${fieldId}-label`}
                                  aria-describedby={`${fieldId}-feedback`}
                                  name={field.name}
                                  chainIds={definition.chainIds}
                                  value={Array.isArray(field.value) ? field.value : emptyNetworks}
                                  onChange={field.onChange}
                                  onBlur={field.onBlur}
                                  triggerRef={field.ref}
                                  isInvalid={fieldState.invalid}
                                  isDisabled={configurationDisabled}
                                  operationalOnly
                                />
                              ) : definition.kind === "network" ? (
                                <TemplateNetworkSelect
                                  aria-labelledby={`${fieldId}-label`}
                                  aria-describedby={`${fieldId}-feedback`}
                                  name={field.name}
                                  chainIds={definition.chainIds}
                                  value={Array.isArray(field.value) ? field.value : emptyNetworks}
                                  onChange={field.onChange}
                                  onBlur={field.onBlur}
                                  triggerRef={field.ref}
                                  isInvalid={fieldState.invalid}
                                  isDisabled={configurationDisabled}
                                />
                              ) : definition.kind === "tokens" ? (
                                <TemplateTokenSelect
                                  aria-labelledby={`${fieldId}-label`}
                                  aria-describedby={`${fieldId}-feedback`}
                                  name={field.name}
                                  options={definition.options}
                                  value={Array.isArray(field.value) ? field.value : emptyNetworks}
                                  onChange={field.onChange}
                                  onBlur={field.onBlur}
                                  triggerRef={field.ref}
                                  isInvalid={fieldState.invalid}
                                  isDisabled={configurationDisabled}
                                />
                              ) : definition.kind === "expiry" ? (
                                <DateTimePolicyField
                                  label={definition.label}
                                  name={field.name}
                                  value={
                                    typeof field.value === "string" ? field.value || null : null
                                  }
                                  onChange={(value) => field.onChange(value ?? "")}
                                  onBlur={field.onBlur}
                                  error={fieldState.error}
                                  isRequired
                                  isDisabled={configurationDisabled}
                                  hideLabel
                                  hideError
                                  aria-describedby={`${fieldId}-feedback`}
                                />
                              ) : definition.kind === "address" ? (
                                <InputGroup fullWidth variant="secondary">
                                  <InputGroup.Input
                                    {...field}
                                    id={fieldId}
                                    aria-describedby={`${fieldId}-feedback`}
                                    aria-invalid={fieldState.invalid}
                                    value={typeof field.value === "string" ? field.value : ""}
                                    autoComplete="off"
                                    autoCapitalize="none"
                                    spellCheck={false}
                                    placeholder={definition.placeholder}
                                    readOnly={form.formState.isSubmitting}
                                    disabled={disabled}
                                  />
                                </InputGroup>
                              ) : (
                                <InputGroup fullWidth variant="secondary">
                                  <InputGroup.Input
                                    {...field}
                                    id={fieldId}
                                    aria-describedby={`${fieldId}-feedback`}
                                    aria-invalid={fieldState.invalid}
                                    value={typeof field.value === "string" ? field.value : ""}
                                    inputMode="decimal"
                                    autoComplete="off"
                                    placeholder="100"
                                    disabled={configurationDisabled}
                                  />
                                  <InputGroup.Suffix>
                                    <span className="text-xs text-muted">{definition.symbol}</span>
                                  </InputGroup.Suffix>
                                </InputGroup>
                              )}
                              <div id={`${fieldId}-feedback`} className="grid gap-1 empty:hidden">
                                {"description" in definition &&
                                typeof definition.description === "string" ? (
                                  <Typography.Paragraph size="xs" color="muted">
                                    {definition.description}
                                  </Typography.Paragraph>
                                ) : null}
                                {fieldState.error ? (
                                  <FieldError>{fieldState.error.message}</FieldError>
                                ) : null}
                              </div>
                            </div>
                          </Field>
                        </DashboardCardRow>
                      );
                    }}
                  />
                ))}
              </FieldGroup>
            </DashboardCardContent>
          </DashboardCardRoot>
          {showApprovalNote ? (
            <Typography.Paragraph role="note" aria-label="Token approval" size="xs" color="muted">
              {template.approvalNote}
            </Typography.Paragraph>
          ) : null}
        </section>
      )}
      {metadataForm.formState.errors.onchain || metadataForm.formState.errors.policies ? (
        <Typography.Paragraph role="alert" size="sm" className="text-danger">
          Review the selected networks and template inputs before creating this key.
        </Typography.Paragraph>
      ) : null}
      {step === "details" ? (
        <Button
          fullWidth
          type="submit"
          form={id}
          isDisabled={disabled || metadataForm.formState.isValidating}
        >
          Continue
        </Button>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="tertiary"
            isDisabled={custodyLocked || form.formState.isSubmitting}
            onPress={() => setStep("details")}
          >
            Back to details
          </Button>
          <Button type="submit" form={id} isDisabled={disabled || form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? template.id === "ens-subname-issuer"
                ? "Checking registry…"
                : "Creating…"
              : "Create session key"}
          </Button>
        </div>
      )}
    </form>
  );
}
