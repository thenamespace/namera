import type { FormEvent } from "react";

import { Button, FieldError, Form, Input, Label, TextField, Typography } from "@namera-ai/ui";
import { useEventCallback } from "usehooks-ts";

type EmailEntryProps = {
  onBack: () => void;
  onContinue: (email: string) => void;
};

export function EmailEntry({ onBack, onContinue }: EmailEntryProps) {
  const handleSubmit = useEventCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const email = new FormData(event.currentTarget).get("email");

    if (typeof email !== "string") {
      return;
    }

    onContinue(email);
  });

  return (
    <Form className="grid gap-4" onSubmit={handleSubmit} validationBehavior="native">
      <Typography.Heading className="mb-3 text-center text-balance text-xl" level={1}>
        What's your email address?
      </Typography.Heading>

      <TextField isRequired fullWidth name="email" type="email">
        <Label className="sr-only">Email address</Label>
        <Input
          autoComplete="email"
          inputMode="email"
          placeholder="richard@piedpiper.com"
          spellCheck={false}
        />
        <FieldError />
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
