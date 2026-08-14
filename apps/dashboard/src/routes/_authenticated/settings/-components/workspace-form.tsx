// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { useEffect } from "react";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { UpdateOrganizationRequest, type GetOrganizationResponse } from "@namera-ai/protocol/dto";
import type { MetadataIcon } from "@namera-ai/protocol/model";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  IconPicker,
  IconPreview,
  Input,
  Typography,
} from "@namera-ai/ui";
import { Controller, useForm } from "react-hook-form";

import {
  DashboardCardContent,
  DashboardCardRoot,
  DashboardCardRow,
} from "@/components/dashboard-card";
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
    <form
      id="workspace-settings-form"
      noValidate
      onSubmit={form.handleSubmit((payload) =>
        canUpdate ? updateOrganization.mutateAsync({ payload }) : Promise.resolve(),
      )}
    >
      <DashboardCardRoot>
        <DashboardCardContent>
          <Controller
            control={form.control}
            name="metadata.logo"
            render={({ field, fieldState }) => (
              <DashboardCardRow className="grid-cols-[minmax(0,1fr)_auto]">
                <Field className="contents" data-invalid={fieldState.invalid}>
                  <FieldLabel>Logo</FieldLabel>
                  {canUpdate ? (
                    <IconPicker
                      aria-label="Choose workspace logo"
                      setValue={field.onChange}
                      size="md"
                      supportedTypes={supportedLogoTypes}
                      triggerClassName="justify-self-end"
                      value={field.value ?? defaultLogo}
                    />
                  ) : (
                    <IconPreview
                      className="justify-self-end"
                      size="md"
                      value={field.value ?? defaultLogo}
                    />
                  )}
                </Field>
              </DashboardCardRow>
            )}
          />

          {canUpdate ? (
            <FieldGroup className="contents">
              <Controller
                control={form.control}
                name="metadata.name"
                render={({ field, fieldState }) => (
                  <DashboardCardRow className="sm:items-start">
                    <Field className="contents" data-invalid={fieldState.invalid}>
                      <div className="grid min-w-0 gap-1">
                        <FieldLabel htmlFor="workspace-name">Workspace name</FieldLabel>
                        {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                      </div>
                      <Input
                        {...field}
                        id="workspace-name"
                        aria-invalid={fieldState.invalid}
                        autoComplete="organization"
                        fullWidth
                        placeholder="Enter workspace name"
                        variant="secondary"
                      />
                    </Field>
                  </DashboardCardRow>
                )}
              />
            </FieldGroup>
          ) : (
            <DashboardCardRow>
              <Typography className="text-sm!">Workspace name</Typography>
              <ReadOnlyInput>{organization.metadata.name}</ReadOnlyInput>
            </DashboardCardRow>
          )}
        </DashboardCardContent>
      </DashboardCardRoot>
    </form>
  );
}
