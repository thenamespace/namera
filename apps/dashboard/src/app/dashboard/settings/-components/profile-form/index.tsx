import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { useCurrentUser, useUpdateUser } from "@/hooks/auth";
import { useAutoSave } from "@/hooks/misc";
import { UpdateUserRequest } from "@namera-ai/schema";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@namera-ai/ui/components/ui/field";
import { IconPicker } from "@namera-ai/ui/components/ui/icon-picker";
import { Input } from "@namera-ai/ui/components/ui/input";

export const ProfileForm = () => {
  const { data: currentUser } = useCurrentUser();

  // TODO: update to skeleton or some loading state
  if (!currentUser) return null;

  return (
    <ProfileFormInner
      key={currentUser.user.id}
      initialValues={{
        name: currentUser.user.name,
        image: currentUser.user.image,
      }}
    />
  );
};

export const ProfileFormInner = ({
  initialValues,
}: {
  initialValues: {
    name: string;
    image?: string | null;
  };
}) => {
  const { mutateAsync: updateUser } = useUpdateUser();

  const form = useForm<UpdateUserRequest>({
    defaultValues: initialValues,
    resolver: standardSchemaResolver(
      Schema.toStandardSchemaV1(UpdateUserRequest),
    ),
  });

  const saveProfile = async (value: UpdateUserRequest) => {
    const savedValue = {
      name: value.name,
      image: value.image ?? "",
    };
    await updateUser(savedValue);
    toast.success("Profile updated successfully");
    return savedValue;
  };

  const { resetBaseline } = useAutoSave({ form, onSave: saveProfile });

  return (
    <form
      className="flex w-full flex-col gap-4"
      id="new-account-form"
      onSubmit={form.handleSubmit(async (value) => {
        const savedValue = await saveProfile(value);
        resetBaseline(savedValue);
      })}
    >
      <div className="flex flex-col gap-2 px-1 py-4">
        <div className="text-2xl font-medium">Profile</div>
      </div>
      <div className="bg-card divide-input/50 flex flex-col gap-3 divide-y rounded-xl border px-4">
        <Controller
          name="image"
          control={form.control}
          render={({ field, fieldState }) => {
            const isInvalid = fieldState.invalid;
            return (
              <Field data-invalid={isInvalid} className="py-3">
                <div className="flex flex-row items-center justify-between">
                  <FieldLabel htmlFor={field.name}>Profile Picture</FieldLabel>
                  <IconPicker
                    allowedTypes={["image"]}
                    value={{
                      type: "image",
                      value: field.value ?? "",
                    }}
                    onChange={(icon) => field.onChange(icon.value)}
                  />
                </div>
                {isInvalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            );
          }}
        />
        <Field className="py-3">
          <div className="flex flex-row items-center justify-between">
            <FieldLabel>Email</FieldLabel>
            <span className="text-sm"></span>
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
