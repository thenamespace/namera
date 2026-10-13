// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useId, useMemo, useState } from "react";

import { Link, useNavigate } from "@tanstack/react-router";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { WalletId } from "@namera-ai/protocol";
import { CreateIdentityRequest, type WalletResponse } from "@namera-ai/protocol/dto";
import {
  Button,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  InputGroup,
  ListBox,
  Select,
  Typography,
  buttonVariants,
} from "@namera-ai/ui";
import { Controller, useForm, useWatch } from "react-hook-form";

import {
  DashboardCardContent,
  DashboardCardRoot,
  DashboardCardRow,
} from "@/components/dashboard-card";
import { MetadataDisplay } from "@/components/display";
import { useEnsNameAvailability } from "@/hooks/ens";
import { useCreateIdentity } from "@/hooks/identity";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

const CreateIdentityForm = Schema.Struct({ ...CreateIdentityRequest.fields, walletId: WalletId });

export function CreateIdentityFormCard({
  wallets,
  initialAccount,
}: {
  wallets: readonly WalletResponse[];
  initialAccount: WalletId | undefined;
}) {
  const id = useId();
  const navigate = useNavigate();
  const [availability, setAvailability] = useState<{ name: string; available: boolean }>();
  const form = useForm<typeof CreateIdentityForm.Encoded, unknown, typeof CreateIdentityForm.Type>({
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(CreateIdentityForm)),
    defaultValues: { label: "", walletId: initialAccount ?? "" },
  });
  const label = useWatch({ control: form.control, name: "label" });
  const accountId = useWatch({ control: form.control, name: "walletId" });
  const selected = wallets.find((wallet) => wallet.id === accountId);
  const cancelSearch = useMemo(() => ({ account: selected?.id, page: 1 }), [selected?.id]);
  const check = useEnsNameAvailability({
    onSuccess: setAvailability,
    onError: (error) => showErrorToast(error, { title: "Couldn’t check name" }),
  });
  const create = useCreateIdentity({
    onSuccess: (identity, input) => {
      showSuccessToast({ title: "Identity created" });
      void navigate({
        to: "/identity/$accountId/$label",
        params: { accountId: input.params.walletId, label: identity.label },
        replace: true,
      });
    },
    onError: (error) =>
      showErrorToast(error, {
        title: "Couldn’t create identity",
        description: "Check your identities before retrying.",
      }),
  });
  return (
    <form
      id={id}
      noValidate
      onSubmit={form.handleSubmit(({ walletId, label: name }) => {
        if (!create.isPending) create.mutate({ params: { walletId }, payload: { label: name } });
      })}
    >
      <DashboardCardRoot>
        <DashboardCardContent>
          <FieldGroup className="contents divide-y divide-separator">
            <Controller
              control={form.control}
              name="walletId"
              render={({ field, fieldState }) => (
                <DashboardCardRow className="sm:items-start">
                  <Field className="contents" data-invalid={fieldState.invalid}>
                    <div className="grid gap-1">
                      <FieldLabel htmlFor={`${id}-account`} isRequired>
                        Account
                      </FieldLabel>
                      {fieldState.invalid ? <FieldError>Select an account.</FieldError> : null}
                    </div>
                    <div className="grid w-full min-w-0 gap-2">
                      <Select
                        aria-label="Account"
                        name={field.name}
                        selectedKey={field.value || null}
                        onSelectionChange={field.onChange}
                        isDisabled={create.isPending}
                        isInvalid={fieldState.invalid}
                        variant="secondary"
                        fullWidth
                        placeholder="Select an account"
                      >
                        <Select.Trigger id={`${id}-account`} ref={field.ref} onBlur={field.onBlur}>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox items={wallets}>
                            {(wallet) => (
                              <ListBox.Item id={wallet.id} textValue={wallet.metadata.name}>
                                <MetadataDisplay
                                  metadata={wallet.metadata}
                                  fallbackName="Account"
                                />
                              </ListBox.Item>
                            )}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                      {selected ? (
                        <Typography
                          className="truncate text-xs text-muted"
                          title={selected.address}
                        >
                          {selected.address}
                        </Typography>
                      ) : null}
                    </div>
                  </Field>
                </DashboardCardRow>
              )}
            />
            <Controller
              control={form.control}
              name="label"
              render={({ field, fieldState }) => (
                <DashboardCardRow className="sm:items-start">
                  <Field className="contents" data-invalid={fieldState.invalid}>
                    <div className="grid gap-1">
                      <FieldLabel htmlFor={`${id}-name`} isRequired>
                        Name
                      </FieldLabel>
                      {fieldState.invalid ? (
                        <FieldError>{fieldState.error?.message}</FieldError>
                      ) : null}
                    </div>
                    <div className="grid w-full min-w-0 gap-2">
                      <InputGroup fullWidth variant="secondary">
                        <InputGroup.Input
                          {...field}
                          id={`${id}-name`}
                          required
                          aria-invalid={fieldState.invalid}
                          autoComplete="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          placeholder="treasury"
                          disabled={create.isPending}
                        />
                        <InputGroup.Suffix>.namera.id</InputGroup.Suffix>
                      </InputGroup>
                      <Button
                        className="w-fit"
                        size="sm"
                        variant="tertiary"
                        isPending={check.isPending}
                        isDisabled={check.isPending || create.isPending}
                        onPress={() =>
                          void form.handleSubmit(({ label: name }) =>
                            check.mutate({ query: { label: name } }),
                          )()
                        }
                      >
                        Check availability
                      </Button>
                      {availability?.name === `${label}.namera.id` ? (
                        <output className="text-sm text-muted">
                          {availability.available
                            ? "This name is available."
                            : "This name is unavailable."}
                        </output>
                      ) : null}
                    </div>
                  </Field>
                </DashboardCardRow>
              )}
            />
          </FieldGroup>
        </DashboardCardContent>
      </DashboardCardRoot>
      <Typography className="mt-4 text-sm text-muted">
        You can edit your public profile and set your Ethereum primary name after creation.
      </Typography>
      <Button
        className="mt-4"
        fullWidth
        form={id}
        type="submit"
        isPending={create.isPending}
        isDisabled={create.isPending}
      >
        Create identity
      </Button>
      {!create.isPending ? (
        <div className="mt-3 text-center">
          <Link
            to="/identity"
            search={cancelSearch}
            className={buttonVariants({ variant: "tertiary" })}
          >
            Cancel
          </Link>
        </div>
      ) : null}
    </form>
  );
}
