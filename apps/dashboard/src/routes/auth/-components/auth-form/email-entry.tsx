import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Button, FieldError, Form, Input, Label, TextField, Typography } from "@namera-ai/ui";
import { useController, useForm } from "react-hook-form";
import { useEventCallback } from "usehooks-ts";

import { EmailFormValidator, type EmailFormInput, type EmailFormOutput } from "./schema";

type EmailEntryProps = {
  onBack: () => void;
  onContinue: (email: EmailFormOutput["email"]) => void;
};

export function EmailEntry({ onBack, onContinue }: EmailEntryProps) {
  const { control, handleSubmit } = useForm<EmailFormInput, unknown, EmailFormOutput>({
    defaultValues: { email: "" },
    resolver: standardSchemaResolver(EmailFormValidator),
  });
  const { field, fieldState } = useController({ control, name: "email" });
  const submit = useEventCallback((values: EmailFormOutput) => onContinue(values.email));
  const handleFormSubmit = handleSubmit(submit);

  return (
    <Form className="grid gap-4" onSubmit={handleFormSubmit} validationBehavior="aria">
      <Typography.Heading className="mb-3 text-center text-balance text-xl" level={1}>
        What's your email address?
      </Typography.Heading>

      <TextField
        isInvalid={fieldState.invalid}
        isRequired
        fullWidth
        name={field.name}
        onChange={field.onChange}
        type="email"
        value={field.value}
      >
        <Label className="sr-only">Email address</Label>
        <Input
          autoComplete="email"
          inputMode="email"
          onBlur={field.onBlur}
          placeholder="richard@piedpiper.com"
          ref={field.ref}
          spellCheck={false}
        />
        <FieldError>{fieldState.error?.message}</FieldError>
      </TextField>

      <Button fullWidth type="submit">
        Continue with email
      </Button>
      <Button fullWidth onPress={onBack} type="button" variant="ghost">
        Back to login
      </Button>
    </Form>
  );
}
