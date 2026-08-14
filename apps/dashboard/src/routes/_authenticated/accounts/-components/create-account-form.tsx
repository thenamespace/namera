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
  ListBox,
  Select,
  Typography,
  cn,
  inputVariants,
  toast,
} from "@namera-ai/ui";
import { ChainIcon, KernelIcon, SafeWalletIcon } from "@namera-ai/ui/icons";
import { Controller, useForm } from "react-hook-form";

import {
  DashboardCardContent,
  DashboardCardRoot,
  DashboardCardRow,
} from "@/components/dashboard-card";
import { useCreateWallet } from "@/hooks/wallet";

const supportedLogoTypes = ["icon", "emoji", "image"] as const;
const defaultLogo: MetadataIcon = { type: "emoji", value: "💳" };
const implementationOptions = [
  { id: "kernel", name: "Kernel", icon: KernelIcon },
  { id: "safe", name: "Safe", icon: SafeWalletIcon },
] as const;
const defaultValues: CreateWalletRequestType = {
  namespace: "eip155",
  protectionLevel: "software",
  implementation: "kernel",
  metadata: {
    version: 1,
    name: "",
    logo: defaultLogo,
  },
};

export function CreateAccountForm() {
  const createWallet = useCreateWallet();
  const navigate = useNavigate();
  const form = useForm<CreateWalletRequestType>({
    defaultValues,
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(CreateWalletRequest)),
  });
  const handleSubmit = form.handleSubmit(async (payload) => {
    try {
      await createWallet.mutateAsync({ payload });
      toast.success("Account created");
      await navigate({ to: "/accounts", replace: true });
    } catch {
      toast.danger("Couldn't create the account.");
    }
  });

  return (
    <form id="create-account-form" noValidate onSubmit={handleSubmit}>
      <DashboardCardRoot>
        <DashboardCardContent>
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

          <FieldGroup className="contents">
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
          </FieldGroup>

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

          <Controller
            control={form.control}
            name="implementation"
            render={({ field, fieldState }) => {
              const selectedImplementation =
                implementationOptions.find((option) => option.id === field.value) ??
                implementationOptions[0];
              const SelectedImplementationIcon = selectedImplementation.icon;

              return (
                <DashboardCardRow className="sm:items-start">
                  <Field className="contents" data-invalid={fieldState.invalid}>
                    <div className="grid min-w-0 gap-1">
                      <FieldLabel id="account-implementation-label">Implementation</FieldLabel>
                      {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                    </div>
                    <Select
                      aria-labelledby="account-implementation-label"
                      fullWidth
                      isInvalid={fieldState.invalid}
                      isRequired
                      name={field.name}
                      onSelectionChange={field.onChange}
                      selectedKey={field.value}
                      variant="secondary"
                    >
                      <Select.Trigger onBlur={field.onBlur} ref={field.ref}>
                        <Select.Value>
                          <span className="flex min-w-0 items-center gap-2">
                            <SelectedImplementationIcon className="size-5 shrink-0" />
                            <span className="truncate">{selectedImplementation.name}</span>
                          </span>
                        </Select.Value>
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox items={implementationOptions}>
                          {(item) => (
                            <ListBox.Item id={item.id} textValue={item.name}>
                              <span className="flex min-w-0 items-center gap-2">
                                <item.icon className="size-5 shrink-0" />
                                <span className="truncate">{item.name}</span>
                              </span>
                            </ListBox.Item>
                          )}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </Field>
                </DashboardCardRow>
              );
            }}
          />
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
