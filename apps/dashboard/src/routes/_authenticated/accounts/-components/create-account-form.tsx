// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { useNavigate } from "@tanstack/react-router";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  CreateWalletRequest,
  type CreateWalletRequest as CreateWalletRequestType,
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
  Typography,
  cn,
  inputVariants,
} from "@namera-ai/ui";
import { AlchemyIcon, ChainIcon } from "@namera-ai/ui/icons";
import { Controller, useForm } from "react-hook-form";

import {
  DashboardCardContent,
  DashboardCardRoot,
  DashboardCardRow,
} from "@/components/dashboard-card";
import { useCreateWallet } from "@/hooks/wallet";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

const supportedLogoTypes = ["icon", "emoji", "image"] as const;
const defaultLogo: MetadataIcon = { type: "emoji", value: "💳" };
const defaultValues: CreateWalletRequestType = {
  namespace: "eip155",
  protectionLevel: "software",
  metadata: {
    version: 1,
    name: "",
    logo: defaultLogo,
  },
};

export function CreateAccountForm() {
  const navigate = useNavigate();
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
  const form = useForm<CreateWalletRequestType>({
    defaultValues,
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(CreateWalletRequest)),
  });
  const handleSubmit = form.handleSubmit((payload) => {
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
        isDisabled={createWallet.isPending}
        type="submit"
      >
        {createWallet.isPending ? "Creating…" : "Create account"}
      </Button>
    </form>
  );
}
