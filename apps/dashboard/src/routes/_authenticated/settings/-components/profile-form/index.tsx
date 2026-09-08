// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { useEffect } from "react";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { UpdateUserRequest, type GetUserResponse } from "@namera-ai/protocol/dto";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  IconPicker,
  Input,
  Typography,
} from "@namera-ai/ui";
import { Controller, useForm } from "react-hook-form";

import { EmailDisplay } from "@/components";
import {
  DashboardCardContent,
  DashboardCardRoot,
  DashboardCardRow,
} from "@/components/dashboard-card";
import { useUpdateUser } from "@/hooks/auth";
import { useAutoSave } from "@/hooks/use-auto-save";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

import { defaultProfileImage, profileFormValues } from "./values";

export function ProfileForm({ user }: { user: GetUserResponse }) {
  const updateUser = useUpdateUser({
    onError: (error) =>
      showErrorToast(error, {
        title: "Couldn’t save profile",
        description: "Your latest changes were not saved.",
      }),
    onSuccess: () => showSuccessToast({ title: "Profile updated successfully" }),
  });
  const form = useForm<UpdateUserRequest>({
    defaultValues: profileFormValues(user),
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(UpdateUserRequest)),
  });
  const { resetBaseline } = useAutoSave({
    form,
    onSave: async (payload) => {
      await updateUser.mutateAsync({ payload });
      return payload;
    },
  });
  useEffect(() => {
    const nextValue = profileFormValues(user);
    form.reset(nextValue);
    resetBaseline(nextValue);
  }, [form, resetBaseline, user]);
  const handleSubmit = form.handleSubmit((payload) => updateUser.mutate({ payload }));

  return (
    <form id="profile-form" noValidate onSubmit={handleSubmit}>
      <DashboardCardRoot>
        <DashboardCardContent>
          <Controller
            control={form.control}
            name="metadata.image"
            render={({ field, fieldState }) => (
              <DashboardCardRow className="grid-cols-[minmax(0,1fr)_auto]">
                <Field className="contents" data-invalid={fieldState.invalid}>
                  <FieldLabel>Profile picture</FieldLabel>
                  <IconPicker
                    aria-label="Choose profile picture"
                    setValue={field.onChange}
                    size="md"
                    // oxlint-disable-next-line react-perf/jsx-no-new-array-as-prop
                    supportedTypes={["image"]}
                    triggerClassName="justify-self-end"
                    value={field.value ?? defaultProfileImage}
                  />
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              </DashboardCardRow>
            )}
          />

          <DashboardCardRow className="grid-cols-[minmax(0,1fr)_auto]">
            <Typography className="text-sm!">Email</Typography>
            <Typography className="text-sm" color="muted" truncate>
              <EmailDisplay email={user.email} />
            </Typography>
          </DashboardCardRow>

          <FieldGroup className="contents">
            <Controller
              control={form.control}
              name="metadata.name"
              render={({ field, fieldState }) => (
                <DashboardCardRow className="sm:items-start">
                  <Field className="contents" data-invalid={fieldState.invalid}>
                    <div className="grid min-w-0 gap-1">
                      <FieldLabel htmlFor="profile-name">Full name</FieldLabel>
                      {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                    </div>
                    <Input
                      {...field}
                      id="profile-name"
                      aria-invalid={fieldState.invalid}
                      autoComplete="name"
                      fullWidth
                      placeholder="Enter your full name"
                      variant="secondary"
                    />
                  </Field>
                </DashboardCardRow>
              )}
            />
          </FieldGroup>
        </DashboardCardContent>
      </DashboardCardRoot>
    </form>
  );
}
