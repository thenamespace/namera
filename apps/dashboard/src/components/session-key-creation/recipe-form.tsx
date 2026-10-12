// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useId, useMemo } from "react";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { CreateEvmSessionKeyRequest, type ListWalletsResponse } from "@namera-ai/protocol/dto";
import type { RegisteredRecipe } from "@namera-ai/recipes";
import { Button, Field, FieldError, FieldLabel, InputGroup, Typography } from "@namera-ai/ui";
import { Controller, useForm, type UseFormReturn } from "react-hook-form";

import { HeadingGroup } from "@/components/heading-group";
import { EvmNetworkMultiSelect } from "@/components/policy/evm/network-multi-select";
import { isChainOperationEnabled } from "@/lib/chain-availability";
import { showErrorToast } from "@/lib/toasts";

import type { CustodyLimits } from "./custody-field";
import { SessionKeyDetailsCard } from "./details-card";
import type { CreateSessionKeyFormInput, CreateSessionKeyFormValues } from "./types";

type RecipeInput = RegisteredRecipe["inputSchema"]["Encoded"];
const emptyNetworks: readonly never[] = [];

export function RecipeCreationForm({
  recipe,
  metadataForm,
  wallets,
  limits,
  custodyLocked,
  disabled,
  onCreate,
}: {
  recipe: RegisteredRecipe;
  metadataForm: UseFormReturn<CreateSessionKeyFormInput, unknown, CreateSessionKeyFormValues>;
  wallets: ListWalletsResponse;
  limits: CustodyLimits;
  custodyLocked: boolean;
  disabled: boolean;
  onCreate: (values: CreateSessionKeyFormValues) => void;
}) {
  const id = useId();
  const schema = useMemo(
    () =>
      recipe.inputSchema.check(
        Schema.makeFilter((input) =>
          input.networks.every(isChainOperationEnabled)
            ? undefined
            : {
                path: ["networks"],
                issue: "Choose networks that are not paused.",
              },
        ),
      ),
    [recipe],
  );
  const form = useForm<RecipeInput>({
    defaultValues: recipe.defaults,
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(schema)),
    mode: "onChange",
  });

  return (
    <form
      id={id}
      noValidate
      className="grid gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled) return;
        void form
          .handleSubmit(async (input) => {
            const generated = recipe.build(input, { now: Math.floor(Date.now() / 1000) });
            metadataForm.setValue(
              "onchain",
              Schema.encodeSync(CreateEvmSessionKeyRequest.fields.onchain)(generated.onchain),
            );
            metadataForm.setValue(
              "policies",
              Schema.encodeSync(CreateEvmSessionKeyRequest.fields.policies)(generated.policies),
            );
            await metadataForm.handleSubmit(onCreate)();
          })(event)
          .catch((error) =>
            showErrorToast(error, {
              title: "Couldn’t prepare session key",
              description: "Review the recipe inputs and try again.",
            }),
          );
      }}
    >
      <section className="grid gap-4">
        <HeadingGroup.Title size="sm">Metadata</HeadingGroup.Title>
        <SessionKeyDetailsCard
          form={metadataForm}
          wallets={wallets}
          limits={limits}
          custodyLocked={custodyLocked}
        />
      </section>
      <section className="grid gap-4" aria-labelledby={`${id}-configuration`}>
        <HeadingGroup.Title id={`${id}-configuration`} size="sm">
          Recipe configuration
        </HeadingGroup.Title>
        {recipe.fields.map((definition) => (
          <Controller
            key={definition.name}
            name={definition.name}
            control={form.control}
            render={({ field, fieldState }) => {
              const fieldId = `${id}-${definition.name}`;
              return (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel id={`${fieldId}-label`} htmlFor={fieldId} isRequired>
                    {definition.label}
                  </FieldLabel>
                  {definition.kind === "networks" ? (
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
                      isDisabled={disabled}
                      operationalOnly
                    />
                  ) : (
                    <InputGroup fullWidth variant="secondary">
                      <InputGroup.Input
                        {...field}
                        id={fieldId}
                        aria-describedby={`${fieldId}-feedback`}
                        aria-invalid={fieldState.invalid}
                        value={typeof field.value === "string" ? field.value : ""}
                        inputMode={definition.kind === "amount" ? "decimal" : "numeric"}
                        autoComplete="off"
                        placeholder={definition.kind === "amount" ? "100" : "30"}
                        disabled={disabled}
                      />
                      <InputGroup.Suffix>
                        <span className="text-xs text-muted">
                          {definition.kind === "amount" ? definition.symbol : "Days"}
                        </span>
                      </InputGroup.Suffix>
                    </InputGroup>
                  )}
                  <div id={`${fieldId}-feedback`} className="grid gap-1">
                    {"description" in definition ? (
                      <Typography.Paragraph size="xs" color="muted">
                        {definition.description}
                      </Typography.Paragraph>
                    ) : null}
                    {fieldState.error ? <FieldError>{fieldState.error.message}</FieldError> : null}
                  </div>
                </Field>
              );
            }}
          />
        ))}
      </section>
      {metadataForm.formState.errors.onchain || metadataForm.formState.errors.policies ? (
        <Typography.Paragraph role="alert" size="sm" className="text-danger">
          Review the selected networks and recipe inputs before creating this key.
        </Typography.Paragraph>
      ) : null}
      <Button
        fullWidth
        type="submit"
        form={id}
        isDisabled={disabled || form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? "Creating…" : "Create session key"}
      </Button>
    </form>
  );
}
