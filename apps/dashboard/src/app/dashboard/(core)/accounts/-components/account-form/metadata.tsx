import type { UseFormReturn } from "react-hook-form";

import type { CreateSmartAccountRequest } from "@namera-ai/schema";

import { Controller } from "react-hook-form";

import { ConnectButton } from "@/components";
import { Card, CardContent } from "@namera-ai/ui/components/ui/card";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@namera-ai/ui/components/ui/field";
import { IconPicker } from "@namera-ai/ui/components/ui/icon-picker";
import { Input } from "@namera-ai/ui/components/ui/input";

type Props = {
  form: UseFormReturn<CreateSmartAccountRequest>;
};

export const Metadata = ({ form }: Props) => {
  return (
    <Card className="py-0">
      <CardContent className="flex flex-col gap-2 divide-y">
        <Controller
          name="metadata.icon"
          control={form.control}
          render={({ field, fieldState }) => {
            const isInvalid = fieldState.invalid;
            return (
              <Field data-invalid={isInvalid} className="flex flex-row py-3">
                <FieldLabel htmlFor={field.name}>Account Icon</FieldLabel>
                <IconPicker
                  value={field.value}
                  onChange={(icon) => field.onChange(icon)}
                />
                {isInvalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            );
          }}
        />
        <div className="flex flex-row items-center justify-between gap-2 py-4">
          <FieldLabel htmlFor="ownerAddress">Account Owner</FieldLabel>
          <ConnectButton />
        </div>
        <Controller
          name="metadata.name"
          control={form.control}
          render={({ field, fieldState }) => {
            const isInvalid = fieldState.invalid;
            return (
              <Field data-invalid={isInvalid} className="py-3">
                <div className="flex flex-row items-center justify-between">
                  <FieldLabel htmlFor={field.name}>Account Name</FieldLabel>
                  <Input
                    className="max-w-48"
                    id={field.name}
                    {...field}
                    onChange={(e) => field.onChange(e.target.value)}
                    aria-invalid={isInvalid}
                    placeholder="eg. My Account"
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
  );
};
