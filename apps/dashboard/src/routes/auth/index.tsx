import { useCallback } from "react";
import type { FormEvent } from "react";

import { createFileRoute } from "@tanstack/react-router";

import { Option, Schema } from "effect";

import { Email } from "@namera-ai/protocol";
import { MagicLinkReturnTo } from "@namera-ai/protocol/dto";
import {
  Alert,
  Button,
  Card,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  Spinner,
  TextField,
  Typography,
} from "@namera-ai/ui";
import { ArrowRight02Icon, HugeiconsIcon, Mail01Icon } from "@namera-ai/ui/icons";

import { AuthShell } from "@/components/auth-shell";
import { useRequestMagicLink } from "@/hooks";

const dashboardPath = Schema.decodeUnknownSync(MagicLinkReturnTo)("/dashboard");

export const Route = createFileRoute("/auth/")({
  component: Login,
});

function Login() {
  const requestMagicLink = useRequestMagicLink();
  const mutate = requestMagicLink.mutate;

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const email = Schema.decodeUnknownOption(Email)(new FormData(form).get("email"));

      if (Option.isNone(email)) {
        return;
      }

      mutate({
        payload: { email: email.value, returnTo: dashboardPath },
      });
    },
    [mutate],
  );

  return (
    <AuthShell>
      <div className="mb-8">
        <Typography.Paragraph color="muted" size="sm">
          Secure sign in
        </Typography.Paragraph>
        <Typography.Heading className="mt-2 text-balance" level={1}>
          Access Your Workspace
        </Typography.Heading>
        <Typography.Paragraph className="mt-3 text-pretty" color="muted">
          Enter your work email. We’ll send a single-use link that expires shortly.
        </Typography.Paragraph>
      </div>

      {requestMagicLink.isSuccess ? (
        <Card>
          <Card.Header>
            <span className="bg-success-soft text-success-soft-foreground grid size-11 place-items-center rounded-xl">
              <HugeiconsIcon aria-hidden="true" icon={Mail01Icon} size={22} />
            </span>
          </Card.Header>
          <Card.Content aria-live="polite">
            <Typography.Heading level={2}>Check Your Inbox</Typography.Heading>
            <Card.Description className="mt-2 text-pretty">
              If this email can sign in, you’ll receive a secure link. Open it in this browser to
              continue.
            </Card.Description>
          </Card.Content>
          <Card.Footer>
            <Button onPress={requestMagicLink.reset} variant="secondary">
              Use another email
            </Button>
          </Card.Footer>
        </Card>
      ) : (
        <Form className="grid gap-5" onSubmit={handleSubmit} validationBehavior="native">
          <TextField isRequired fullWidth name="email" type="email">
            <Label>Work Email</Label>
            <Input
              autoComplete="email"
              inputMode="email"
              placeholder="you@company.com"
              spellCheck={false}
            />
            <Description>We’ll never ask for a password.</Description>
            <FieldError />
          </TextField>

          {requestMagicLink.isError ? (
            <Alert status="danger" role="alert">
              <Alert.Content>
                <Alert.Title>We couldn’t send the sign-in link</Alert.Title>
                <Alert.Description>Please wait a moment, then try again.</Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}

          <Button fullWidth isDisabled={requestMagicLink.isPending} type="submit">
            {requestMagicLink.isPending ? (
              <>
                <Spinner size="sm" /> Sending link…
              </>
            ) : (
              <>
                Send Secure Link
                <HugeiconsIcon aria-hidden="true" icon={ArrowRight02Icon} size={18} />
              </>
            )}
          </Button>
        </Form>
      )}

      <Typography.Paragraph className="mt-6 text-pretty" color="muted" size="xs">
        By signing in, you authorize this browser to create a Namera session. The link can only be
        used once.
      </Typography.Paragraph>
    </AuthShell>
  );
}
