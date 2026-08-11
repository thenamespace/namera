import { Button, FieldError, Form, Input, Label, TextField, Typography } from "@namera-ai/ui";

import { AuthShell } from "./auth-shell";

export function AuthForm() {
  return (
    <AuthShell stepKey="request-magic-link">
      <Form className="grid gap-4" validationBehavior="native">
        <Typography.Heading className="mb-3 text-center text-balance text-xl" level={1}>
          Get started with Namera
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

        <Button fullWidth type="button">
          Continue with email
        </Button>
      </Form>
    </AuthShell>
  );
}
