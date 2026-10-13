// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useEffect, useId, useMemo, useState } from "react";

import { Link, useNavigate } from "@tanstack/react-router";

import { Option, Schema } from "effect";

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
  Spinner,
  buttonVariants,
} from "@namera-ai/ui";
import { CancelCircleIcon, CheckmarkCircle02Icon, HugeiconsIcon } from "@namera-ai/ui/icons";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useDebounceValue } from "usehooks-ts";

import {
  DashboardCardContent,
  DashboardCardRoot,
  DashboardCardRow,
} from "@/components/dashboard-card";
import { MetadataDisplay } from "@/components/display";
import { useEnsNameAvailability } from "@/hooks/ens";
import { useCreateIdentity, useIdentities } from "@/hooks/identity";
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
  const [availability, setAvailability] = useState<{
    label: string;
    status: "available" | "unavailable" | "error";
  }>();
  const form = useForm<typeof CreateIdentityForm.Encoded, unknown, typeof CreateIdentityForm.Type>({
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(CreateIdentityForm)),
    defaultValues: { label: "", walletId: initialAccount ?? "" },
  });
  const label = useWatch({ control: form.control, name: "label" });
  const normalizedLabel = Option.getOrUndefined(
    Schema.decodeUnknownOption(CreateIdentityRequest.fields.label)(label),
  );
  const [debouncedLabel] = useDebounceValue(normalizedLabel, 400);
  const accountId = useWatch({ control: form.control, name: "walletId" });
  const selected = wallets.find((wallet) => wallet.id === accountId);
  const cancelSearch = useMemo(() => ({ account: selected?.id, page: 1 }), [selected?.id]);
  const { mutate: checkAvailability, cancel: cancelAvailability } = useEnsNameAvailability({
    onSuccess: (result, input) =>
      setAvailability({
        label: input.query.label,
        status: result.available ? "available" : "unavailable",
      }),
    onError: (_error, input) => setAvailability({ label: input.query.label, status: "error" }),
  });
  useEffect(() => {
    if (!debouncedLabel || debouncedLabel !== normalizedLabel) return;
    checkAvailability({ query: { label: debouncedLabel } });
    return cancelAvailability;
  }, [debouncedLabel, normalizedLabel, checkAvailability, cancelAvailability]);
  const availabilityStatus = !normalizedLabel
    ? undefined
    : normalizedLabel !== debouncedLabel || availability?.label !== normalizedLabel
      ? "checking"
      : availability.status;
  const availabilityText =
    availabilityStatus === "checking"
      ? "Checking availability"
      : availabilityStatus === "available"
        ? "Name is available"
        : availabilityStatus === "unavailable"
          ? "Name is unavailable"
          : availabilityStatus === "error"
            ? "Couldn’t check availability. Edit the name to retry."
            : "";
  const create = useCreateIdentity({
    onSuccess: (_identity, input) => {
      showSuccessToast({ title: "Identity created" });
      void navigate({
        to: "/identity",
        search: { account: input.params.walletId },
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
        <DashboardCardContent className="gap-0">
          <FieldGroup className="contents divide-y divide-separator">
            <Controller
              control={form.control}
              name="walletId"
              render={({ field, fieldState }) => (
                <DashboardCardRow>
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
                    </div>
                  </Field>
                </DashboardCardRow>
              )}
            />
            <Controller
              control={form.control}
              name="label"
              render={({ field, fieldState }) => (
                <DashboardCardRow>
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
                          aria-describedby={`${id}-availability`}
                          autoComplete="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          placeholder="treasury"
                          disabled={create.isPending}
                        />
                        <InputGroup.Suffix>
                          <span className="inline-flex items-center gap-2">
                            .namera.id
                            {availabilityStatus ? (
                              <span title={availabilityText} aria-hidden="true">
                                {availabilityStatus === "checking" ? (
                                  <Spinner className="size-4" />
                                ) : (
                                  <HugeiconsIcon
                                    icon={
                                      availabilityStatus === "available"
                                        ? CheckmarkCircle02Icon
                                        : CancelCircleIcon
                                    }
                                    className={
                                      availabilityStatus === "available"
                                        ? "size-4 text-success"
                                        : "size-4 text-danger"
                                    }
                                  />
                                )}
                              </span>
                            ) : null}
                          </span>
                        </InputGroup.Suffix>
                      </InputGroup>
                      <output id={`${id}-availability`} className="sr-only">
                        {availabilityText}
                      </output>
                    </div>
                  </Field>
                </DashboardCardRow>
              )}
            />
          </FieldGroup>
        </DashboardCardContent>
      </DashboardCardRoot>
      <div className="mt-6 flex items-center justify-between gap-4">
        {!create.isPending ? (
          <Link
            to="/identity"
            search={cancelSearch}
            className={buttonVariants({ variant: "tertiary" })}
          >
            Cancel
          </Link>
        ) : (
          <span />
        )}
        {selected ? (
          <CreateIdentityAction
            walletId={selected.id}
            formId={id}
            pending={create.isPending}
            disabled={availabilityStatus === "checking" || availabilityStatus === "unavailable"}
          />
        ) : (
          <Button isDisabled>Create identity</Button>
        )}
      </div>
    </form>
  );
}

function CreateIdentityAction({
  walletId,
  formId,
  pending,
  disabled,
}: {
  walletId: WalletId;
  formId: string;
  pending: boolean;
  disabled: boolean;
}) {
  const identities = useIdentities(walletId);
  const search = useMemo(() => ({ account: walletId }), [walletId]);
  if (identities.isError)
    return (
      <Button variant="tertiary" onPress={identities.refetch}>
        Retry account check
      </Button>
    );
  if (identities.data?.items.length)
    return (
      <Link to="/identity" search={search} className={buttonVariants({ variant: "secondary" })}>
        View existing identity
      </Link>
    );
  return (
    <Button
      form={formId}
      type="submit"
      isPending={pending}
      isDisabled={pending || disabled || !identities.data}
    >
      Create identity
    </Button>
  );
}
