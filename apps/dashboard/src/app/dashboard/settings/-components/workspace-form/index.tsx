import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { HeadingGroup } from "@/components/misc";
import { useCurrentUser } from "@/hooks/auth";
import { useUpdateOrganization } from "@/hooks/auth/organization";
import { useAutoSave } from "@/hooks/misc";
import { UpdateOrganizationRequest } from "@namera-ai/schema/dto";
import { Button } from "@namera-ai/ui/components/ui/button";
import { Card, CardContent } from "@namera-ai/ui/components/ui/card";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@namera-ai/ui/components/ui/field";
import { IconPicker } from "@namera-ai/ui/components/ui/icon-picker";
import { Input } from "@namera-ai/ui/components/ui/input";

export const WorkspaceUpdateForm = () => {
  const { data: currentUser } = useCurrentUser();

  if (!currentUser || !currentUser.organization) return null;

  return (
    <WorkspaceUpdateFormInner
      key={currentUser.organization.id}
      initialValues={{
        name: currentUser.organization.name,
        metadata: currentUser.organization.metadata,
      }}
    />
  );
};

export const WorkspaceUpdateFormInner = ({
  initialValues,
}: {
  initialValues: UpdateOrganizationRequest;
}) => {
  const { mutateAsync: updateOrganization } = useUpdateOrganization();
  const form = useForm<UpdateOrganizationRequest>({
    defaultValues: initialValues,
    resolver: standardSchemaResolver(
      Schema.toStandardSchemaV1(UpdateOrganizationRequest),
    ),
  });

  const saveWorkspace = async (value: UpdateOrganizationRequest) => {
    await updateOrganization(value);
    toast.success("Workspace updated successfully");
    return value;
  };

  const { resetBaseline } = useAutoSave({ form, onSave: saveWorkspace });

  return (
    <form
      className="flex w-full flex-col gap-4"
      id="new-account-form"
      onSubmit={form.handleSubmit(async (value) => {
        const savedValue = await saveWorkspace(value);
        resetBaseline(savedValue);
      })}
    >
      <HeadingGroup heading="Workspace" size="lg" />
      <Card className="py-0">
        <CardContent>
          <Controller
            name="metadata.logo"
            control={form.control}
            render={({ field, fieldState }) => {
              const isInvalid = fieldState.invalid;
              return (
                <Field data-invalid={isInvalid} className="flex flex-row py-3">
                  <FieldLabel htmlFor={field.name}>Logo</FieldLabel>
                  <IconPicker
                    value={field.value}
                    onChange={(icon) => field.onChange(icon)}
                  />
                  {isInvalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              );
            }}
          />
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => {
              const isInvalid = fieldState.invalid;
              return (
                <Field data-invalid={isInvalid} className="py-3">
                  <div className="flex flex-row items-center justify-between">
                    <FieldLabel htmlFor={field.name}>Workspace Name</FieldLabel>
                    <Input
                      className="max-w-48"
                      id={field.name}
                      {...field}
                      onChange={(e) => field.onChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="eg. My Workspace"
                      autoComplete="off"
                    />
                  </div>
                  {isInvalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              );
            }}
          />
        </CardContent>
      </Card>
      <HeadingGroup heading="Danger Zone" size="sm" className="pb-0" />
      <Card className="py-0">
        <CardContent>
          <Field className="py-3">
            <div className="flex flex-row items-center justify-between">
              <FieldLabel>Delete Workspace</FieldLabel>
              <Button variant="destructive" className="my-2" type="button">
                Delete Workspace
              </Button>
            </div>
          </Field>
        </CardContent>
      </Card>
    </form>
  );
};
