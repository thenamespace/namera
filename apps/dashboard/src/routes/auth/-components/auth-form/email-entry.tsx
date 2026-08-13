import { Button, FieldError, Form, Input, Label, TextField, Typography } from "@namera-ai/ui";
import { useController, useFormContext } from "react-hook-form";
import { useEventCallback } from "usehooks-ts";

import type { EmailFormInput, EmailFormOutput } from "./schema";

type EmailEntryProps = {
  errorMessage?: string | undefined;
  isPending: boolean;
  onBack: () => void;
  onContinue: (values: EmailFormOutput) => Promise<void>;
};

export function EmailEntry({ errorMessage, isPending, onBack, onContinue }: EmailEntryProps) {
  const { control, handleSubmit } = useFormContext<EmailFormInput, unknown, EmailFormOutput>();
  const { field, fieldState } = useController({ control, name: "email" });
  const submit = useEventCallback((values: EmailFormOutput) => onContinue(values));
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
        variant="secondary"
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

      <Button fullWidth isDisabled={isPending} type="submit">
        {isPending ? "Sending link..." : "Continue with email"}
      </Button>
      {errorMessage ? (
        <Typography.Paragraph className="text-danger text-center" role="alert" size="sm">
          {errorMessage}
        </Typography.Paragraph>
      ) : null}
      <Button fullWidth isDisabled={isPending} onPress={onBack} type="button" variant="ghost">
        Back to login
      </Button>
    </Form>
  );
}
