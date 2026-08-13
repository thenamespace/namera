import { useNavigate } from "@tanstack/react-router";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  CreateOrganizationRequest,
  type CreateOrganizationRequest as CreateOrganizationRequestType,
} from "@namera-ai/protocol/dto";
import type { MetadataIcon } from "@namera-ai/protocol/model";
import {
  Button,
  FieldError,
  Form,
  IconPicker,
  Input,
  Label,
  Typography,
  toast,
} from "@namera-ai/ui";
import { useController, useForm } from "react-hook-form";

import { DashboardCard } from "@/components/dashboard-card";
import { useCreateOrganization } from "@/hooks/auth";

const supportedLogoTypes = ["icon", "emoji", "image"] as const;
const defaultLogo: MetadataIcon = { type: "emoji", value: "🏢" };
const defaultValues: CreateOrganizationRequestType = {
  metadata: {
    version: 1,
    name: "",
    logo: defaultLogo,
  },
};

export function CreateWorkspaceForm() {
  const createOrganization = useCreateOrganization();
  const navigate = useNavigate();
  const form = useForm<CreateOrganizationRequestType>({
    defaultValues,
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(CreateOrganizationRequest)),
  });
  const logo = useController({ control: form.control, name: "metadata.logo" });
  const name = useController({ control: form.control, name: "metadata.name" });

  const handleSubmit = form.handleSubmit(async (payload) => {
    try {
      await createOrganization.mutateAsync({ payload });
      toast.success("Workspace created");
      await navigate({ to: "/", replace: true });
    } catch {
      toast.danger("Couldn't create the workspace.");
    }
  });

  return (
    <Form onSubmit={handleSubmit} validationBehavior="aria">
      <DashboardCard>
        <DashboardCard.Content>
          <DashboardCard.Row className="grid-cols-[minmax(0,1fr)_auto]">
            <Typography className="text-sm!">Workspace logo</Typography>
            <IconPicker
              aria-label="Choose workspace logo"
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
              <Label>Workspace name</Label>
              <FieldError>{name.fieldState.error?.message}</FieldError>
            </DashboardCard.FieldLabel>
            <Input
              autoComplete="organization"
              fullWidth
              onBlur={name.field.onBlur}
              placeholder="Enter workspace name"
              ref={name.field.ref}
            />
          </DashboardCard.Field>
        </DashboardCard.Content>
      </DashboardCard>
      <Button isDisabled={createOrganization.isPending} type="submit" fullWidth className="mt-4">
        {createOrganization.isPending ? "Creating…" : "Create workspace"}
      </Button>
    </Form>
  );
}
