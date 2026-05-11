import { Controller, type UseFormReturn } from "react-hook-form";

import {
  Field,
  FieldError,
  FieldLabel,
} from "@namera-ai/ui/components/ui/field";
import { IconPicker } from "@namera-ai/ui/components/ui/icon-picker";
import { Input } from "@namera-ai/ui/components/ui/input";
import { Textarea } from "@namera-ai/ui/components/ui/textarea";

import type { NewSessionKeyFormSchema } from "./schema";

type FormProps = {
  form: UseFormReturn<NewSessionKeyFormSchema>;
};

export const Metadata = ({ form }: FormProps) => {
  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="text-xl">Metadata</div>
      <div className="bg-card flex flex-col gap-2 divide-y rounded-xl border px-4">
        <Controller
          name="metadata.icon"
          control={form.control}
          render={({ field, fieldState }) => {
            const isInvalid = fieldState.invalid;
            return (
              <Field data-invalid={isInvalid} className="flex flex-row py-3">
                <FieldLabel htmlFor={field.name}>Icon</FieldLabel>
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
          name="metadata.name"
          control={form.control}
          render={({ field, fieldState }) => {
            const isInvalid = fieldState.invalid;
            return (
              <Field data-invalid={isInvalid} className="py-3">
                <div className="flex flex-row items-center justify-between">
                  <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                  <Input
                    className="max-w-48"
                    id={field.name}
                    {...field}
                    onChange={(e) => field.onChange(e.target.value)}
                    aria-invalid={isInvalid}
                    placeholder="eg. ENS Session Key"
                    autoComplete="off"
                  />
                </div>
                {isInvalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            );
          }}
        />
        <Controller
          name="metadata.description"
          control={form.control}
          render={({ field, fieldState }) => {
            const isInvalid = fieldState.invalid;
            return (
              <Field data-invalid={isInvalid} className="py-3">
                <div className="flex flex-row items-start justify-between">
                  <FieldLabel htmlFor={field.name} className="pt-1">
                    Description
                  </FieldLabel>
                  <Textarea
                    className="max-w-[20rem]"
                    id={field.name}
                    {...field}
                    onChange={(e) => field.onChange(e.target.value)}
                    aria-invalid={isInvalid}
                    placeholder="eg. Session key for performing ENS Renewals and Transfers"
                    autoComplete="off"
                  />
                </div>
                {isInvalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            );
          }}
        />
      </div>
    </div>
  );
};
