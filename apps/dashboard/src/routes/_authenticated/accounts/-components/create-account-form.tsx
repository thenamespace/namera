// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { useNavigate } from "@tanstack/react-router";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  Button,
  Chip,
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
import { AlchemyIcon, ChainIcon, NameraIcon, SolanaIcon } from "@namera-ai/ui/icons";
import { startRegistration } from "@simplewebauthn/browser";
import { Controller, useForm } from "react-hook-form";

import {
  DashboardCardContent,
  DashboardCardRoot,
  DashboardCardRow,
} from "@/components/dashboard-card";
import { WalletOwnerDisplay } from "@/components/display/wallet-owner-display";
import { useCreatePasskeyRegistrationOptions, useCreateWallet } from "@/hooks/wallet";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

import {
  CreateAccountFormValues,
  type CreateAccountFormValuesEncoded,
  defaultAccountLogo,
  defaultAccountValues,
} from "./create-account-schema";

const supportedLogoTypes = ["icon", "emoji", "image"] as const;

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
    defaultValues: defaultAccountValues,
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(CreateAccountFormValues)),
  });
  const handleSubmit = form.handleSubmit(async (values) => {
    const ceremony = await registrationOptions.mutateAsync().catch(() => undefined);
    if (ceremony === undefined) return;
    const passkeyName = `${values.metadata.name} - Namera`;
    const response = await startRegistration({
      optionsJSON: {
        ...ceremony.options,
        // Labels describe this wallet; the server-issued user handle and RP stay unchanged.
        user: { ...ceremony.options.user, name: passkeyName, displayName: passkeyName },
      } as Parameters<typeof startRegistration>[0]["optionsJSON"],
    }).catch((error: unknown) => {
      showErrorToast(error, {
        title: "Passkey setup was not completed",
        description: "No account was created. You can try again when ready.",
      });
      return undefined;
    });
    if (response === undefined) return;
    const owner = {
      type: "passkey" as const,
      verificationId: ceremony.verificationId,
      response,
    };

    await createWallet
      .mutateAsync({
        payload: {
          namespace: "eip155",
          owner,
          metadata: values.metadata,
        },
      })
      .catch(() => undefined);
  });
  const isPending =
    form.formState.isSubmitting || registrationOptions.isPending || createWallet.isPending;

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
                      value={field.value ?? defaultAccountLogo}
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
                      <FieldLabel htmlFor="create-account-name" isRequired>
                        Account name
                      </FieldLabel>
                      {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                    </div>
                    <Input
                      {...field}
                      id="create-account-name"
                      required
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
                    />
                  </Field>
                </DashboardCardRow>
              )}
            />

            <DashboardCardRow>
              <Typography.Paragraph size="sm">Ownership</Typography.Paragraph>
              <Select aria-label="Ownership" selectedKey="local" variant="secondary" fullWidth>
                <Select.Trigger>
                  <Select.Value className="flex items-center gap-2" />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id="local" textValue="User-owned passkey">
                      <WalletOwnerDisplay custody="local" />
                    </ListBox.Item>
                    <ListBox.Item id="namera-managed" textValue="Namera managed" isDisabled>
                      <NameraIcon aria-hidden className="size-4 shrink-0 fill-current" />
                      <span>Namera managed</span>
                      <Chip size="sm" variant="soft">
                        Coming soon
                      </Chip>
                    </ListBox.Item>
                  </ListBox>
                </Select.Popover>
              </Select>
            </DashboardCardRow>

            <DashboardCardRow>
              <Typography className="text-sm!">Network</Typography>
              <Select aria-label="Network" selectedKey="eip155" variant="secondary" fullWidth>
                <Select.Trigger>
                  <Select.Value className="flex items-center gap-2" />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id="eip155" textValue="EVM">
                      <ChainIcon chain="ethereum" namespace="eip155" />
                      EVM
                    </ListBox.Item>
                    <ListBox.Item id="solana" textValue="Solana" isDisabled>
                      <SolanaIcon aria-hidden className="size-4 shrink-0" />
                      <span>Solana</span>
                      <Chip size="sm" variant="soft">
                        Coming soon
                      </Chip>
                    </ListBox.Item>
                  </ListBox>
                </Select.Popover>
              </Select>
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
        {isPending ? "Waiting for passkey…" : "Create account"}
      </Button>
    </form>
  );
}
