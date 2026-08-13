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
  FieldError,
  Form,
  IconPicker,
  Input,
  Label,
  ListBox,
  Select,
  Typography,
  toast,
} from "@namera-ai/ui";
import { useController, useForm } from "react-hook-form";

import { DashboardCard } from "@/components/dashboard-card";
import { useCreateWallet } from "@/hooks/wallet";

const supportedLogoTypes = ["icon", "emoji", "image"] as const;
const defaultLogo: MetadataIcon = { type: "emoji", value: "💳" };
const implementationOptions = [
  { id: "kernel", name: "Kernel" },
  { id: "safe", name: "Safe" },
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
  const logo = useController({ control: form.control, name: "metadata.logo" });
  const name = useController({ control: form.control, name: "metadata.name" });
  const implementation = useController({ control: form.control, name: "implementation" });

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
    <Form onSubmit={handleSubmit} validationBehavior="aria">
      <DashboardCard>
        <DashboardCard.Content>
          <DashboardCard.Row className="grid-cols-[minmax(0,1fr)_auto]">
            <Typography className="text-sm!">Account logo</Typography>
            <IconPicker
              aria-label="Choose account logo"
              setValue={logo.field.onChange}
              size="md"
              supportedTypes={supportedLogoTypes}
              value={logo.field.value ?? defaultLogo}
            />
          </DashboardCard.Row>

          <DashboardCard.Field
            isInvalid={name.fieldState.invalid}
            isRequired
            name={name.field.name}
            onChange={name.field.onChange}
            value={name.field.value}
          >
            <DashboardCard.FieldLabel>
              <Label>Account name</Label>
              <FieldError>{name.fieldState.error?.message}</FieldError>
            </DashboardCard.FieldLabel>
            <Input
              autoComplete="off"
              fullWidth
              onBlur={name.field.onBlur}
              placeholder="Enter account name"
              ref={name.field.ref}
            />
          </DashboardCard.Field>

          <DashboardCard.Row>
            <Typography className="text-sm!">Namespace</Typography>
            <Typography className="text-sm!">EVM</Typography>
          </DashboardCard.Row>

          <DashboardCard.Row className="sm:items-start">
            <DashboardCard.FieldLabel>
              <Label id="account-implementation-label">Implementation</Label>
              {implementation.fieldState.error?.message ? (
                <Typography className="text-danger text-xs" role="alert">
                  {implementation.fieldState.error.message}
                </Typography>
              ) : null}
            </DashboardCard.FieldLabel>
            <Select
              aria-labelledby="account-implementation-label"
              fullWidth
              isInvalid={implementation.fieldState.invalid}
              isRequired
              name={implementation.field.name}
              onSelectionChange={implementation.field.onChange}
              selectedKey={implementation.field.value}
              variant="secondary"
            >
              <Select.Trigger onBlur={implementation.field.onBlur} ref={implementation.field.ref}>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox items={implementationOptions}>
                  {(item) => (
                    <ListBox.Item id={item.id} textValue={item.name}>
                      {item.name}
                    </ListBox.Item>
                  )}
                </ListBox>
              </Select.Popover>
            </Select>
          </DashboardCard.Row>
        </DashboardCard.Content>
      </DashboardCard>

      <Button className="mt-4" fullWidth isDisabled={createWallet.isPending} type="submit">
        {createWallet.isPending ? "Creating…" : "Create account"}
      </Button>
    </Form>
  );
}
