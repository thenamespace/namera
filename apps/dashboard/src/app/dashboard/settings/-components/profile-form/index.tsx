import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Controller, useForm } from "react-hook-form";

import {
  Field,
  FieldError,
  FieldLabel,
} from "@namera-ai/ui/components/ui/field";
import { Input } from "@namera-ai/ui/components/ui/input";

import { ProfileUpdateSchema } from "./schema";

const handleSubmit = async (value: ProfileUpdateSchema) => {
  console.log(value);
};

export const ProfileForm = () => {
  const form = useForm<ProfileUpdateSchema>({
    defaultValues: {
      fullName: "Vedant Chainani",
    },
    resolver: standardSchemaResolver(
      Schema.toStandardSchemaV1(ProfileUpdateSchema),
    ),
  });

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
            <span className="text-sm">vedantchainani1084@gmail.com</span>
          </div>
        </Field>
        <Controller
          name="fullName"
          control={form.control}
          render={({ field, fieldState }) => {
            const isInvalid = fieldState.invalid;
            return (
              <Field data-invalid={isInvalid} className="py-3">
                <div className="flex flex-row items-center justify-between">
                  <FieldLabel htmlFor={field.name}>Full Name</FieldLabel>
                  <Input
                    className="max-w-48"
                    id={field.name}
                    {...field}
                    onChange={(e) => field.onChange(e.target.value)}
                    aria-invalid={isInvalid}
                    placeholder="eg.- Richard Hendricks"
                    autoComplete="off"
                  />
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
