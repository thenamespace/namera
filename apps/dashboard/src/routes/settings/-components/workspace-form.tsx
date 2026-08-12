import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { UpdateOrganizationRequest } from "@namera-ai/protocol/dto";
import type { MetadataIcon } from "@namera-ai/protocol/model";
import { FieldError, Form, IconPicker, Input, Label, Typography } from "@namera-ai/ui";
import { useController, useForm } from "react-hook-form";

import { DashboardCard } from "@/components/dashboard-card";

const supportedLogoTypes = ["icon", "emoji", "image"] as const;
const defaultLogo: MetadataIcon = { type: "emoji", value: "🏢" };
const defaultValues: UpdateOrganizationRequest = {
  metadata: {
    version: 1,
    name: "Workspace",
    logo: defaultLogo,
  },
};

export function WorkspaceForm() {
  const form = useForm<UpdateOrganizationRequest>({
    defaultValues,
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(UpdateOrganizationRequest)),
  });
  const logo = useController({ control: form.control, name: "metadata.logo" });
  const name = useController({ control: form.control, name: "metadata.name" });

  return (
    <Form onSubmit={form.handleSubmit(() => undefined)} validationBehavior="aria">
      <DashboardCard>
        <DashboardCard.Content>
          <DashboardCard.Row className="grid-cols-[minmax(0,1fr)_auto]">
            <Typography className="text-sm!">Logo</Typography>
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
            <Label>Workspace name</Label>
            <div className="w-full">
              <Input
                autoComplete="organization"
                fullWidth
                onBlur={name.field.onBlur}
                placeholder="Enter workspace name"
                ref={name.field.ref}
                variant="secondary"
              />
              <FieldError>{name.fieldState.error?.message}</FieldError>
            </div>
          </DashboardCard.Field>
        </DashboardCard.Content>
      </DashboardCard>
    </Form>
  );
}
