import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Controller, useForm } from "react-hook-form";

import { createOrganization } from "@/actions/auth/organization";
import { HeadingGroup } from "@/components/misc";
import { queries } from "@/lib/query";
import { CreateOrganizationRequest } from "@namera-ai/schema";
import { Button } from "@namera-ai/ui/components/ui/button";
import { Card, CardContent } from "@namera-ai/ui/components/ui/card";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@namera-ai/ui/components/ui/field";
import { IconPicker } from "@namera-ai/ui/components/ui/icon-picker";
import { Input } from "@namera-ai/ui/components/ui/input";

export const NewWorkspaceForm = () => {
  const router = useRouter();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useForm<CreateOrganizationRequest>({
    defaultValues: {
      name: "",
      metadata: {
        logo: {
          type: "icon",
          value: "wallet",
        },
      },
    },
    resolver: standardSchemaResolver(
      Schema.toStandardSchemaV1(CreateOrganizationRequest),
    ),
  });

  const handleSubmit = async (value: CreateOrganizationRequest) => {
    await createOrganization(value);
    await queryClient.cancelQueries(queries.auth.me);
    queryClient.setQueryData(queries.auth.me.queryKey, null);
    await router.invalidate();
    await navigate({ to: "/dashboard" });
  };

  return (
    <form
      className="flex w-full flex-col gap-4"
      id="new-account-form"
      onSubmit={form.handleSubmit(handleSubmit)}
    >
      <HeadingGroup
        heading={<div className="text-center">Create a workspace</div>}
        description={
          <div className="text-center">
            Collaborate with your team and manage accounts.
          </div>
        }
        size="lg"
      />
      <Card className="py-0">
        <CardContent>
          <Controller
            name="metadata.logo"
            control={form.control}
            render={({ field, fieldState }) => {
              const isInvalid = fieldState.invalid;
              return (
                <Field data-invalid={isInvalid} className="flex flex-row py-3">
                  <FieldLabel htmlFor={field.name}>Workspace Logo</FieldLabel>
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
      <Button
        variant="default"
        size="lg"
        className="my-2"
        type="submit"
        disabled={form.formState.isSubmitting}
      >
        Create Workspace
      </Button>
    </form>
  );
};
