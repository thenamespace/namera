import type { UseFormReturn } from "react-hook-form";

import type { CreateSmartAccountRequest } from "@namera-ai/schema";

import { CheckCircleIcon } from "@phosphor-icons/react";
import { Controller } from "react-hook-form";

import { HeadingGroup } from "@/components/misc";
import { Card, CardContent } from "@namera-ai/ui/components/ui/card";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@namera-ai/ui/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@namera-ai/ui/components/ui/input-group";

type Props = {
  form: UseFormReturn<CreateSmartAccountRequest>;
};

export const EnsDetails = ({ form }: Props) => {
  return (
    <>
      <HeadingGroup
        heading="Identity"
        description="Give your account a human-readable identity by connecting it to an ENS domain."
        className="pb-0"
      />
      <Card className="py-0">
        <CardContent className="flex flex-col gap-2 divide-y">
          <Controller
            name="metadata.icon"
            control={form.control}
            render={({ field, fieldState }) => {
              const isInvalid = fieldState.invalid;
              return (
                <Field data-invalid={isInvalid} className="flex flex-row py-3">
                  <FieldLabel htmlFor={field.name}>ENS Domain</FieldLabel>
                  <InputGroup className="h-10 border-0">
                    <InputGroupInput placeholder="subdomain" />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>.namera.eth</InputGroupText>
                      <CheckCircleIcon className="fill-primary" />
                      {/* <SpinnerIcon className="animate-spin" /> */}
                    </InputGroupAddon>
                  </InputGroup>

                  {isInvalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              );
            }}
          />
        </CardContent>
      </Card>
    </>
  );
};
