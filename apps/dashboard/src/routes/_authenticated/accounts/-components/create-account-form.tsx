// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { useNavigate } from "@tanstack/react-router";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import type { CreateWalletRequest } from "@namera-ai/protocol/dto";
import { WalletKeyProtectionLevel, WalletMetadata } from "@namera-ai/protocol/model";
import type { MetadataIcon } from "@namera-ai/protocol/model";
import {
  Button,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  IconPicker,
  Input,
  ListBox,
  Select,
  TextArea,
  Typography,
  cn,
  inputVariants,
} from "@namera-ai/ui";
import { AlchemyIcon, ChainIcon } from "@namera-ai/ui/icons";
import { startRegistration } from "@simplewebauthn/browser";
import { Controller, useForm } from "react-hook-form";

import {
  DashboardCardContent,
  DashboardCardRoot,
  DashboardCardRow,
} from "@/components/dashboard-card";
import { useCreatePasskeyRegistrationOptions, useCreateWallet } from "@/hooks/wallet";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

const supportedLogoTypes = ["icon", "emoji", "image"] as const;
const defaultLogo: MetadataIcon = { type: "emoji", value: "💳" };
const ownerOptions = [
  {
    id: "passkey",
    name: "User-owned passkey",
    description: "You approve ownership with this device. Namera never holds the owner key.",
  },
  {
    id: "namera-managed",
    name: "Namera managed",
    description: "Namera secures the owner key and signs approved operations for you.",
  },
] as const;
const protectionOptions = [
  { id: "software", name: "Software" },
  { id: "hsm", name: "HSM" },
] as const;

const CreateAccountFormValues = Schema.Struct({
  ownerType: Schema.Literals(["passkey", "namera-managed"]),
  protectionLevel: WalletKeyProtectionLevel,
  metadata: WalletMetadata,
});
type CreateAccountFormValues = typeof CreateAccountFormValues.Type;
type CreateAccountFormValuesEncoded = typeof CreateAccountFormValues.Encoded;

const defaultValues: CreateAccountFormValuesEncoded = {
  ownerType: "passkey",
  protectionLevel: "software",
  metadata: {
    version: 1,
    name: "",
    logo: defaultLogo,
  },
};

export function CreateAccountForm() {
  const navigate = useNavigate();
  const registrationOptions = useCreatePasskeyRegistrationOptions({
    onError: (error) =>
      showErrorToast(error, {
        title: "Couldn’t start passkey setup",
        description: "Check that passkeys are available on this device and try again.",
      }),
  });
  const createWallet = useCreateWallet({
    onError: (error) =>
      showErrorToast(error, {
        title: "Couldn’t create account",
        description: "Review the account details and try again.",
      }),
    onSuccess: () => {
      showSuccessToast({
        title: "Account created",
        description: "Your smart account was created successfully.",
      });
      void navigate({ to: "/accounts", replace: true });
    },
  });
  const form = useForm<CreateAccountFormValuesEncoded, unknown, CreateAccountFormValues>({
    defaultValues,
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(CreateAccountFormValues)),
  });
  const ownerType = form.watch("ownerType");
  const handleSubmit = form.handleSubmit((values) => {
    void (async () => {
      let owner: CreateWalletRequest["owner"];
      if (values.ownerType === "passkey") {
        const ceremony = await registrationOptions.mutateAsync().catch(() => undefined);
        if (ceremony === undefined) return;
        const response = await startRegistration({
          optionsJSON: ceremony.options as Parameters<typeof startRegistration>[0]["optionsJSON"],
        }).catch((error: unknown) => {
          showErrorToast(error, {
            title: "Passkey setup was not completed",
            description: "No account was created. You can try again when ready.",
          });
          return undefined;
        });
        if (response === undefined) return;
        owner = {
          type: "passkey",
          verificationId: ceremony.verificationId,
          response,
        };
      } else {
        owner = {
          type: "namera-managed",
          protectionLevel: values.protectionLevel,
        };
      }

      await createWallet
        .mutateAsync({
          payload: {
            namespace: "eip155",
            owner,
            metadata: values.metadata,
          },
        })
        .catch(() => undefined);
    })();
  });
  const isPending = registrationOptions.isPending || createWallet.isPending;

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
                      placeholder="Enter account name"
                      variant="secondary"
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
              name="ownerType"
              render={({ field, fieldState }) => (
                <DashboardCardRow className="sm:items-start">
                  <Field className="contents" data-invalid={fieldState.invalid}>
                    <div className="grid min-w-0 gap-1">
                      <FieldLabel id="create-account-owner-label">Ownership</FieldLabel>
                      {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                    </div>
                    <Select
                      aria-labelledby="create-account-owner-label"
                      fullWidth
                      isInvalid={fieldState.invalid}
                      selectedKey={field.value}
                      variant="secondary"
                      onSelectionChange={field.onChange}
                    >
                      <Select.Trigger onBlur={field.onBlur} ref={field.ref}>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox items={ownerOptions}>
                          {(option) => (
                            <ListBox.Item id={option.id} textValue={option.name}>
                              <div className="grid min-w-0 gap-0.5">
                                <span>{option.name}</span>
                                <span className="text-xs text-muted">{option.description}</span>
                              </div>
                            </ListBox.Item>
                          )}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </Field>
                </DashboardCardRow>
              )}
            />

            {ownerType === "namera-managed" ? (
              <Controller
                control={form.control}
                name="protectionLevel"
                render={({ field, fieldState }) => (
                  <DashboardCardRow>
                    <Field className="contents" data-invalid={fieldState.invalid}>
                      <FieldLabel id="create-account-protection-label">Key protection</FieldLabel>
                      <Select
                        aria-labelledby="create-account-protection-label"
                        fullWidth
                        isInvalid={fieldState.invalid}
                        selectedKey={field.value}
                        variant="secondary"
                        onSelectionChange={field.onChange}
                      >
                        <Select.Trigger onBlur={field.onBlur} ref={field.ref}>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox items={protectionOptions}>
                            {(option) => (
                              <ListBox.Item id={option.id} textValue={option.name}>
                                {option.name}
                              </ListBox.Item>
                            )}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    </Field>
                  </DashboardCardRow>
                )}
              />
            ) : null}

            <DashboardCardRow>
              <Typography className="text-sm!">Namespace</Typography>
              <div
                className={cn(
                  inputVariants({ variant: "secondary" }),
                  "flex flex-row items-center gap-2",
                )}
              >
                <ChainIcon chain="ethereum" namespace="eip155" />
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
        isDisabled={isPending}
        type="submit"
      >
        {isPending
          ? ownerType === "passkey"
            ? "Waiting for passkey…"
            : "Creating…"
          : "Create account"}
      </Button>
    </form>
  );
}
