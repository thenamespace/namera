import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { UpdateUserRequest } from "@namera-ai/protocol/dto";
import type { MetadataIcon } from "@namera-ai/protocol/model";
import { FieldError, Form, IconPicker, Input, Label, Typography } from "@namera-ai/ui";
import { useController, useForm } from "react-hook-form";

import { DashboardCard } from "@/components/dashboard-card";

const defaultImage: MetadataIcon = { type: "emoji", value: "👤" };

const defaultValues: UpdateUserRequest = {
  metadata: {
    version: 1,
    image: defaultImage,
    name: "",
  },
};

export function ProfileForm() {
  const form = useForm<UpdateUserRequest>({
    defaultValues,
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(UpdateUserRequest)),
  });
  const image = useController({ control: form.control, name: "metadata.image" });
  const name = useController({ control: form.control, name: "metadata.name" });
  const handleSubmit = form.handleSubmit(() => undefined);

  return (
    <Form onSubmit={handleSubmit} validationBehavior="aria">
      <DashboardCard>
        <DashboardCard.Content>
          <DashboardCard.Row className="grid-cols-[minmax(0,1fr)_auto]">
            <Typography className="text-sm!">Profile picture</Typography>
            <IconPicker
              aria-label="Choose profile picture"
              setValue={image.field.onChange}
              size="lg"
              // oxlint-disable-next-line react-perf/jsx-no-new-array-as-prop
              supportedTypes={["image"]}
              value={image.field.value ?? defaultImage}
            />
          </DashboardCard.Row>

          <DashboardCard.Row className="grid-cols-[minmax(0,1fr)_auto]">
            <Typography className="text-sm!">Email</Typography>
            <Typography className="text-sm" color="muted" truncate>
              vedant@envoy1084.xyz
            </Typography>
          </DashboardCard.Row>

          <DashboardCard.Field
            isInvalid={name.fieldState.invalid}
            isRequired
            name={name.field.name}
            onChange={name.field.onChange}
            value={name.field.value ?? ""}
          >
            <DashboardCard.FieldLabel>
              <Label>Full name</Label>
              <FieldError>{name.fieldState.error?.message}</FieldError>
            </DashboardCard.FieldLabel>
            <Input
              autoComplete="name"
              fullWidth
              onBlur={name.field.onBlur}
              placeholder="Enter your full name"
              ref={name.field.ref}
              variant="secondary"
            />
          </DashboardCard.Field>
        </DashboardCard.Content>
      </DashboardCard>
    </Form>
  );
}
