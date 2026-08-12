import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Avatar, Card, FieldError, Form, Input, Label, TextField, Typography } from "@namera-ai/ui";
import { HugeiconsIcon, UserCircleIcon } from "@namera-ai/ui/icons";
import { useController, useForm } from "react-hook-form";

import { ProfileFormValidator, type ProfileFormInput, type ProfileFormOutput } from "./schema";

const defaultValues: ProfileFormInput = {
  email: "",
  image: "",
  name: "",
};

export function ProfileForm() {
  const form = useForm<ProfileFormInput, unknown, ProfileFormOutput>({
    defaultValues,
    resolver: standardSchemaResolver(ProfileFormValidator),
  });
  const image = useController({ control: form.control, name: "image" });
  const email = useController({ control: form.control, name: "email" });
  const name = useController({ control: form.control, name: "name" });
  const handleSubmit = form.handleSubmit(() => undefined);

  return (
    <Form onSubmit={handleSubmit} validationBehavior="aria">
      <Card variant="secondary" className="overflow-hidden">
        <Card.Content className="divide-separator divide-y p-0">
          <div className="grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-6 px-5 py-4 sm:px-6">
            <Typography weight="medium">Profile picture</Typography>
            <Avatar size="lg">
              {image.field.value ? (
                <Avatar.Image alt="Profile picture" src={image.field.value} />
              ) : null}
              <Avatar.Fallback>
                <HugeiconsIcon icon={UserCircleIcon} />
              </Avatar.Fallback>
            </Avatar>
          </div>

          <div className="grid min-h-18 grid-cols-[minmax(0,1fr)_auto] items-center gap-6 px-5 py-4 sm:px-6">
            <Typography weight="medium">Email</Typography>
            <Typography color="muted" truncate>
              {email.field.value || "No email address"}
            </Typography>
          </div>

          <TextField
            className="grid min-h-20 grid-cols-1 items-start gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)] sm:items-center sm:gap-6 sm:px-6"
            isInvalid={name.fieldState.invalid}
            isRequired
            name={name.field.name}
            onChange={name.field.onChange}
            value={name.field.value}
          >
            <Label className="font-medium">Full name</Label>
            <div>
              <Input
                autoComplete="name"
                onBlur={name.field.onBlur}
                placeholder="Enter your full name"
                ref={name.field.ref}
              />
              <FieldError>{name.fieldState.error?.message}</FieldError>
            </div>
          </TextField>
        </Card.Content>
      </Card>
    </Form>
  );
}
