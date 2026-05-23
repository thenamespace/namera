import { useCallback, useEffect } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { updateUser } from "@/actions";
import { useCurrentUser } from "@/hooks/auth";
import { useAutoSave } from "@/hooks/misc";
import { queries } from "@/lib/query";
import { UpdateUserRequest } from "@namera-ai/schema";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@namera-ai/ui/components/ui/field";
import { Input } from "@namera-ai/ui/components/ui/input";

export const ProfileForm = () => {
  const { data: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();

  const form = useForm<UpdateUserRequest>({
    defaultValues: {
      name: currentUser?.user.name ?? "",
    },
    resolver: standardSchemaResolver(
      Schema.toStandardSchemaV1(UpdateUserRequest),
    ),
  });

  const updateProfile = useMutation({
    mutationFn: async ({ name }: UpdateUserRequest) => updateUser({ name }),
    onSuccess: async () => {
      await queryClient.invalidateQueries(queries.auth.me);
    },
  });

  const handleSubmit = useCallback(
    async (value: UpdateUserRequest) => {
      console.log("[ProfileForm] autosave submit called", {
        value,
        currentUserName: currentUser?.user.name,
      });

      if (value.name === currentUser?.user.name) {
        console.log("[ProfileForm] autosave skipped: unchanged name");
        return;
      }

      await updateProfile.mutateAsync(value);
      console.log("[ProfileForm] autosave mutation completed");
      toast.success("Profile updated successfully");
    },
    [currentUser?.user.name, updateProfile],
  );

  const { resetBaseline } = useAutoSave({ form, onSave: handleSubmit });

  useEffect(() => {
    if (!currentUser || form.formState.isDirty) return;

    const values = { name: currentUser.user.name };
    console.log("[ProfileForm] hydrating profile form", values);
    form.reset(values);
    resetBaseline(values);
  }, [currentUser, form, resetBaseline]);

  return (
    <form
      className="flex w-full flex-col gap-4"
      id="new-account-form"
      onSubmit={form.handleSubmit(handleSubmit)}
    >
      <div className="flex flex-col gap-2 px-1 py-4">
        <div className="text-2xl font-medium">Profile</div>
      </div>
      <div className="bg-card divide-input/50 flex flex-col gap-3 divide-y rounded-xl border px-4">
        <Field className="flex flex-row py-3">
          <FieldLabel>Profile Picture</FieldLabel>
          <img
            src="https://euc.li/envoy1084.eth"
            className="border-input size-8 max-w-8 rounded-full border"
          />
        </Field>
        <Field className="py-3">
          <div className="flex flex-row items-center justify-between">
            <FieldLabel>Email</FieldLabel>
            <span className="text-sm">{currentUser?.user.email}</span>
          </div>
        </Field>
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => {
            const isInvalid = fieldState.invalid;
            return (
              <Field data-invalid={isInvalid} className="py-3">
                <div className="flex flex-row items-center justify-between">
                  <FieldLabel htmlFor={field.name}>Full Name</FieldLabel>
                  <div className="flex items-center gap-2">
                    <Input
                      className="max-w-48"
                      id={field.name}
                      {...field}
                      onChange={(e) => {
                        field.onChange(e.target.value);
                      }}
                      aria-invalid={isInvalid}
                      placeholder="eg.- Richard Hendricks"
                      autoComplete="off"
                    />
                  </div>
                </div>
                {isInvalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            );
          }}
        />
      </div>
    </form>
  );
};
