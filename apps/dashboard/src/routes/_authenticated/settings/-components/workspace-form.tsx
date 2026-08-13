import { useEffect } from "react";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { UpdateOrganizationRequest, type GetOrganizationResponse } from "@namera-ai/protocol/dto";
import type { MetadataIcon } from "@namera-ai/protocol/model";
import { FieldError, Form, IconPicker, IconPreview, Input, Label, Typography } from "@namera-ai/ui";
import { useController, useForm } from "react-hook-form";

import { DashboardCard } from "@/components/dashboard-card";
import { ReadOnlyInput } from "@/components/read-only-input";
import { useUpdateOrganization } from "@/hooks/auth";
import { useAutoSave } from "@/hooks/use-auto-save";

const supportedLogoTypes = ["icon", "emoji", "image"] as const;
const defaultLogo: MetadataIcon = { type: "emoji", value: "🏢" };

type WorkspaceFormProps = {
  canUpdate: boolean;
  organization: GetOrganizationResponse;
};

export function WorkspaceForm({ canUpdate, organization }: WorkspaceFormProps) {
  const updateOrganization = useUpdateOrganization();
  const form = useForm<UpdateOrganizationRequest>({
    defaultValues: { metadata: organization.metadata },
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(UpdateOrganizationRequest)),
  });
  const logo = useController({ control: form.control, name: "metadata.logo" });
  const name = useController({ control: form.control, name: "metadata.name" });

  const { resetBaseline } = useAutoSave({
    enabled: canUpdate,
    form,
    onSave: async (payload) => {
      await updateOrganization.mutateAsync({ payload });
      return payload;
    },
  });

  useEffect(() => {
    const nextValue = { metadata: organization.metadata };
    form.reset(nextValue);
    resetBaseline(nextValue);
  }, [form, organization, resetBaseline]);

  return (
    <Form
      onSubmit={form.handleSubmit((payload) =>
        canUpdate ? updateOrganization.mutateAsync({ payload }) : Promise.resolve(),
      )}
      validationBehavior="aria"
    >
      <DashboardCard>
        <DashboardCard.Content>
          <DashboardCard.Row className="grid-cols-[minmax(0,1fr)_auto]">
            <Typography className="text-sm!">Logo</Typography>
            {canUpdate ? (
              <IconPicker
                aria-label="Choose workspace logo"
                setValue={logo.field.onChange}
                size="md"
                supportedTypes={supportedLogoTypes}
                value={logo.field.value ?? defaultLogo}
              />
            ) : (
              <IconPreview size="md" value={logo.field.value ?? defaultLogo} />
            )}
          </DashboardCard.Row>

          {canUpdate ? (
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
                variant="secondary"
              />
            </DashboardCard.Field>
          ) : (
            <DashboardCard.Row>
              <Typography className="text-sm!">Workspace name</Typography>
              <ReadOnlyInput>{name.field.value}</ReadOnlyInput>
            </DashboardCard.Row>
          )}
        </DashboardCard.Content>
      </DashboardCard>
    </Form>
  );
}
