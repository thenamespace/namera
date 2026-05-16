import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { CheckCircleIcon } from "@phosphor-icons/react";
import { Controller, useForm } from "react-hook-form";

import { HeadingGroup } from "@/components/misc";
import { MetadataIcon } from "@namera-ai/schema";
import { Button } from "@namera-ai/ui/components/ui/button";
import { Card, CardContent } from "@namera-ai/ui/components/ui/card";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@namera-ai/ui/components/ui/field";
import { IconPicker } from "@namera-ai/ui/components/ui/icon-picker";
import { Input } from "@namera-ai/ui/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@namera-ai/ui/components/ui/input-group";
import { Spinner } from "@namera-ai/ui/components/ui/spinner";

const NewWorkspaceRequest = Schema.Struct({
  metadata: Schema.Struct({
    name: Schema.String,
    logo: MetadataIcon,
  }),
  slug: Schema.String.check(
    Schema.isPattern(/^[a-z0-9][a-z0-9-]{2,62}[a-z0-9]$/, {
      message: "Invalid slug",
    }),
    Schema.isLengthBetween(3, 63, {
      message: "Slug must be between 3 and 63 characters",
    }),
  ),
});

type NewWorkspaceRequest = typeof NewWorkspaceRequest.Type;

const handleSubmit = (value: NewWorkspaceRequest) => {
  console.log(value);
};

export const NewWorkspaceForm = () => {
  const form = useForm<NewWorkspaceRequest>({
    defaultValues: {
      metadata: {
        logo: {
          type: "icon",
          value: "wallet",
        },
        name: "",
      },
    },
    resolver: standardSchemaResolver(
      Schema.toStandardSchemaV1(NewWorkspaceRequest),
    ),
  });

  const slug = form.watch("slug");

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
            name="metadata.name"
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
          <Controller
            name="slug"
            control={form.control}
            render={({ field, fieldState }) => {
              const isInvalid = fieldState.invalid;
              return (
                <Field data-invalid={isInvalid} className="py-3">
                  <div className="flex flex-row items-center justify-between">
                    <div className="flex flex-col">
                      <FieldLabel htmlFor={field.name}>
                        Workspace Slug
                      </FieldLabel>
                      <span className="text-muted-foreground text-[10px]">
                        dashboard.namera.ai/{slug}
                      </span>
                    </div>
                    <InputGroup className="max-w-48">
                      <InputGroupInput
                        id={field.name}
                        {...field}
                        onChange={(e) => field.onChange(e.target.value)}
                        aria-invalid={isInvalid}
                        placeholder="my-workspace"
                        autoComplete="off"
                      />
                      <InputGroupAddon align="inline-end">
                        <CheckCircleIcon />
                        <Spinner />
                      </InputGroupAddon>
                    </InputGroup>
                  </div>
                  {isInvalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              );
            }}
          />
        </CardContent>
      </Card>
      <Button variant="default" size="lg" className="my-2">
        Create Workspace
      </Button>
    </form>
  );
};
