// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
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
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  IconPicker,
  Input,
} from "@namera-ai/ui";
import { Controller, useForm } from "react-hook-form";

import {
  DashboardCardContent,
  DashboardCardRoot,
  DashboardCardRow,
} from "@/components/dashboard-card";
import { useCreateOrganization } from "@/hooks/auth";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

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
  const navigate = useNavigate();
  const createOrganization = useCreateOrganization({
    onError: (error) =>
      showErrorToast(error, {
        title: "Couldn’t create workspace",
        description: "Review the workspace details and try again.",
      }),
    onSuccess: () => {
      showSuccessToast({
        title: "Workspace created",
        description: "You are now working in the new workspace.",
      });
      void navigate({ to: "/", replace: true });
    },
  });
  const form = useForm<CreateOrganizationRequestType>({
    defaultValues,
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(CreateOrganizationRequest)),
  });
  const handleSubmit = form.handleSubmit((payload) => {
    createOrganization.mutate({ payload });
  });

  return (
    <form id="create-workspace-form" noValidate onSubmit={handleSubmit}>
      <DashboardCardRoot>
        <DashboardCardContent>
          <Controller
            control={form.control}
            name="metadata.logo"
            render={({ field, fieldState }) => (
              <DashboardCardRow className="grid-cols-[minmax(0,1fr)_auto]">
                <Field className="contents" data-invalid={fieldState.invalid}>
                  <FieldLabel>Workspace logo</FieldLabel>
                  <IconPicker
                    aria-label="Choose workspace logo"
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
                      <FieldLabel htmlFor="create-workspace-name">Workspace name</FieldLabel>
                      {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                    </div>
                    <Input
                      {...field}
                      id="create-workspace-name"
                      aria-invalid={fieldState.invalid}
                      autoComplete="organization"
                      fullWidth
                      placeholder="Enter workspace name"
                    />
                  </Field>
                </DashboardCardRow>
              )}
            />
          </FieldGroup>
        </DashboardCardContent>
      </DashboardCardRoot>
      <Button
        className="mt-4"
        form="create-workspace-form"
        fullWidth
        isDisabled={createOrganization.isPending}
        type="submit"
      >
        {createOrganization.isPending ? "Creating…" : "Create workspace"}
      </Button>
    </form>
  );
}
