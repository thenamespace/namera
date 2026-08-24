import { useEffect } from "react";

// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { useNavigate } from "@tanstack/react-router";

import { Option, Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { EnsLabel } from "@namera-ai/protocol";
import {
  CreateWalletRequest,
  type CreateWalletRequest as CreateWalletRequestType,
  type CreateWalletRequestEncoded,
} from "@namera-ai/protocol/dto";
import type { MetadataIcon } from "@namera-ai/protocol/model";
import {
  Button,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  IconPicker,
  Input,
  InputGroup,
  Spinner,
  TextArea,
  Typography,
  cn,
  inputVariants,
} from "@namera-ai/ui";
import {
  AlchemyIcon,
  CancelCircleIcon,
  ChainIcon,
  CheckmarkCircle02Icon,
  HugeiconsIcon,
} from "@namera-ai/ui/icons";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useDebounceValue } from "usehooks-ts";

import {
  DashboardCardContent,
  DashboardCardRoot,
  DashboardCardRow,
} from "@/components/dashboard-card";
import { useEnsNameAvailability } from "@/hooks/ens";
import { useCreateWallet } from "@/hooks/wallet";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

const supportedLogoTypes = ["icon", "emoji", "image"] as const;
const defaultLogo: MetadataIcon = { type: "emoji", value: "💳" };
const defaultValues: CreateWalletRequestEncoded = {
  namespace: "eip155",
  ensLabel: "",
  protectionLevel: "software",
  metadata: {
    version: 1,
    name: "",
    logo: defaultLogo,
  },
};

export function CreateAccountForm() {
  const navigate = useNavigate();
  const ensAvailability = useEnsNameAvailability();
  const {
    cancel: cancelEnsAvailability,
    mutate: checkEnsAvailability,
    reset: resetEnsAvailability,
  } = ensAvailability;
  const createWallet = useCreateWallet({
    onError: (error) =>
      showErrorToast(error, {
        title: "Couldn’t create account",
        description: "Review the account details and try again.",
      }),
    onSuccess: () => {
      showSuccessToast({
        title: "Account created",
        description: "Your smart account is ready to use.",
      });
      void navigate({ to: "/accounts", replace: true });
    },
  });
  const form = useForm<CreateWalletRequestEncoded, unknown, CreateWalletRequestType>({
    defaultValues,
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(CreateWalletRequest)),
  });
  const ensLabel = useWatch({ control: form.control, name: "ensLabel" });
  const [debouncedEnsLabel] = useDebounceValue(ensLabel, 350);
  const decodedEnsLabel = Schema.decodeUnknownOption(EnsLabel)(ensLabel);
  const normalizedEnsLabel = Option.getOrUndefined(decodedEnsLabel);
  const currentAvailability =
    ensAvailability.data?.label === normalizedEnsLabel ? ensAvailability.data : undefined;
  const isCurrentLabelAvailable =
    normalizedEnsLabel !== undefined && currentAvailability?.available === true;

  useEffect(() => {
    cancelEnsAvailability();
    resetEnsAvailability();
  }, [cancelEnsAvailability, ensLabel, resetEnsAvailability]);

  useEffect(() => {
    const decoded = Schema.decodeUnknownOption(EnsLabel)(debouncedEnsLabel);
    if (Option.isSome(decoded)) {
      checkEnsAvailability({ query: { label: decoded.value } });
    }
  }, [checkEnsAvailability, debouncedEnsLabel]);

  const handleSubmit = form.handleSubmit((payload) => {
    if (!isCurrentLabelAvailable) return;
    createWallet.mutate({ payload });
  });

  return (
    <form id="create-account-form" noValidate onSubmit={handleSubmit}>
      <DashboardCardRoot>
        <DashboardCardContent>
          <FieldGroup className="divide-separator contents divide-y">
            <Controller
              control={form.control}
              name="metadata.logo"
              render={({ field, fieldState }) => (
                <DashboardCardRow className="grid-cols-[minmax(0,1fr)_auto]">
                  <Field className="contents" data-invalid={fieldState.invalid}>
                    <FieldLabel>Account logo</FieldLabel>
                    <IconPicker
                      aria-label="Choose account logo"
                      setValue={field.onChange}
                      size="md"
                      supportedTypes={supportedLogoTypes}
                      triggerClassName="justify-self-end"
                      value={field.value ?? defaultLogo}
                    />
                  </Field>
                </DashboardCardRow>
              )}
            />

            <Controller
              control={form.control}
              name="metadata.name"
              render={({ field, fieldState }) => (
                <DashboardCardRow className="sm:items-start">
                  <Field className="contents" data-invalid={fieldState.invalid}>
                    <div className="grid min-w-0 gap-1">
                      <FieldLabel htmlFor="create-account-name">Account name</FieldLabel>
                      {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                    </div>
                    <Input
                      {...field}
                      id="create-account-name"
                      aria-invalid={fieldState.invalid}
                      autoComplete="off"
                      fullWidth
                      variant="secondary"
                      placeholder="Enter account name"
                    />
                  </Field>
                </DashboardCardRow>
              )}
            />

            <Controller
              control={form.control}
              name="metadata.description"
              render={({ field, fieldState }) => (
                <DashboardCardRow className="sm:items-start">
                  <Field className="contents" data-invalid={fieldState.invalid}>
                    <div className="grid min-w-0 gap-1">
                      <FieldLabel htmlFor="create-account-description">Description</FieldLabel>
                      {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                    </div>
                    <TextArea
                      {...field}
                      id="create-account-description"
                      aria-invalid={fieldState.invalid}
                      autoComplete="off"
                      fullWidth
                      placeholder="Describe how this account will be used"
                      rows={3}
                      value={field.value ?? ""}
                      variant="secondary"
                      onChange={(event) => field.onChange(event.target.value || undefined)}
                    />
                  </Field>
                </DashboardCardRow>
              )}
            />

            <Controller
              control={form.control}
              name="ensLabel"
              render={({ field, fieldState }) => (
                <DashboardCardRow className="sm:items-start">
                  <Field className="contents" data-invalid={fieldState.invalid}>
                    <div className="grid min-w-0 gap-1">
                      <FieldLabel htmlFor="create-account-ens-label">ENS name</FieldLabel>
                    </div>
                    <div className="flex min-w-0 items-center gap-2">
                      <InputGroup className="min-w-0 flex-1" fullWidth variant="secondary">
                        <InputGroup.Input
                          {...field}
                          id="create-account-ens-label"
                          aria-invalid={fieldState.invalid}
                          autoCapitalize="none"
                          autoComplete="off"
                          placeholder="treasury"
                        />
                        <InputGroup.Suffix>.namera.id</InputGroup.Suffix>
                      </InputGroup>
                      {normalizedEnsLabel !== undefined && ensAvailability.isPending ? (
                        <Spinner className="size-4 shrink-0" />
                      ) : currentAvailability !== undefined ? (
                        <HugeiconsIcon
                          className={cn(
                            "size-4 shrink-0",
                            currentAvailability.available ? "text-success" : "text-danger",
                          )}
                          icon={
                            currentAvailability.available ? CheckmarkCircle02Icon : CancelCircleIcon
                          }
                        />
                      ) : null}
                    </div>
                  </Field>
                </DashboardCardRow>
              )}
            />

            <DashboardCardRow>
              <Typography className="text-sm!">Namespace</Typography>
              <div
                className={cn(
                  inputVariants({ variant: "secondary" }),
                  "flex flex-row items-center gap-2",
                )}
              >
                <ChainIcon namespace="eip155" chain="ethereum" />
                EVM
              </div>
            </DashboardCardRow>

            <DashboardCardRow>
              <Typography className="text-sm!">Account type</Typography>
              <div
                className={cn(
                  inputVariants({ variant: "secondary" }),
                  "flex flex-row items-center gap-2",
                )}
              >
                <AlchemyIcon aria-hidden className="size-5 shrink-0" />
                Alchemy Modular V2
              </div>
            </DashboardCardRow>
          </FieldGroup>
        </DashboardCardContent>
      </DashboardCardRoot>

      <Button
        className="mt-4"
        form="create-account-form"
        fullWidth
        isDisabled={createWallet.isPending || !isCurrentLabelAvailable}
        type="submit"
      >
        {createWallet.isPending ? "Creating…" : "Create account"}
      </Button>
    </form>
  );
}
