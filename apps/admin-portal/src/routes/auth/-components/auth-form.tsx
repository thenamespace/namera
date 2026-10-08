// oxlint-disable react-perf/jsx-no-new-function-as-prop react-perf/jsx-no-new-array-as-prop
import { useState } from "react";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  Button,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Typography,
} from "@namera-ai/ui";
import { BrandGoogleIcon } from "@namera-ai/ui/icons";
import { Controller, useForm } from "react-hook-form";

import { useGoogleConfiguration, useStartGoogle, useRequestMagicLink } from "@/hooks/auth";
import { authErrorMessage } from "@/lib/auth-feedback";

import { AuthShell } from "./auth-shell";
import { EmailConfirmation } from "./email-confirmation";
import { type EmailForm, EmailValidator } from "./schema";

export function AuthForm({ denied, google }: { denied: boolean; google?: string | undefined }) {
  const [step, setStep] = useState<"options" | "email" | "code">("options");
  const form = useForm<typeof EmailForm.Encoded, unknown, typeof EmailForm.Type>({
    defaultValues: { email: "" },
    resolver: standardSchemaResolver(EmailValidator),
  });
  const configuration = useGoogleConfiguration();
  const startGoogle = useStartGoogle({
    onSuccess: ({ authorizationUrl }) => window.location.assign(authorizationUrl),
  });
  const request = useRequestMagicLink({ onSuccess: () => setStep("code") });
  const back = () => {
    request.reset();
    startGoogle.reset();
    setStep("options");
  };
  const error =
    request.error ??
    startGoogle.error ??
    (google ? { _tag: "GoogleAuthError", code: google } : null);

  return (
    <AuthShell stepKey={`auth-step-${step}`}>
      {denied ? (
        <Typography.Paragraph align="center" className="mb-6" size="sm" role="alert">
          This account doesn’t have admin access. Sign in with your team account or ask the owner
          for access.
        </Typography.Paragraph>
      ) : null}
      {step === "options" ? (
        <div className="grid gap-4">
          <Typography.Heading
            align="center"
            className="mb-3 text-center text-balance text-xl"
            level={1}
            weight="medium"
          >
            Log in to Namera Admin
          </Typography.Heading>
          {configuration.data?.enabled ? (
            <Button
              fullWidth
              isPending={startGoogle.isPending}
              onPress={() => startGoogle.mutate({ payload: { surface: "admin" } })}
            >
              <BrandGoogleIcon aria-hidden="true" className="size-4 shrink-0" />
              Continue with Google
            </Button>
          ) : null}
          {configuration.isPending ? (
            <output className="text-muted text-sm text-center">Loading sign-in options...</output>
          ) : null}
          {configuration.error ? (
            <p className="text-muted text-sm text-center" role="alert">
              Couldn’t load Google sign-in. You can still use email.
            </p>
          ) : null}
          <Button
            fullWidth
            variant="tertiary"
            isDisabled={startGoogle.isPending}
            onPress={() => setStep("email")}
          >
            Continue with email
          </Button>
        </div>
      ) : step === "email" ? (
        <form
          id="admin-email-form"
          className="grid gap-4"
          noValidate
          onSubmit={form.handleSubmit((payload) =>
            request.mutate({ payload: { ...payload, surface: "admin", returnTo: "/" } }),
          )}
        >
          <Typography.Heading align="center" className="mb-3 text-balance text-xl" level={1}>
            What's your email address?
          </Typography.Heading>
          <FieldGroup>
            <Controller
              control={form.control}
              name="email"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel className="sr-only" htmlFor="admin-email">
                    Email address
                  </FieldLabel>
                  <Input
                    {...field}
                    id="admin-email"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={fieldState.error ? "admin-email-error" : undefined}
                    autoComplete="email"
                    inputMode="email"
                    fullWidth
                    placeholder="you@example.com"
                    spellCheck={false}
                    type="email"
                    variant="secondary"
                    disabled={request.isPending}
                  />
                  <FieldError id="admin-email-error" errors={[fieldState.error]} />
                </Field>
              )}
            />
          </FieldGroup>
          <Button form="admin-email-form" fullWidth isDisabled={request.isPending} type="submit">
            {request.isPending ? "Sending link..." : "Continue with email"}
          </Button>
          <Button fullWidth variant="ghost" isDisabled={request.isPending} onPress={back}>
            Back to login
          </Button>
        </form>
      ) : (
        <EmailConfirmation email={form.getValues("email")} onBack={back} />
      )}
      {error ? (
        <Typography.Paragraph align="center" role="alert" size="sm" className="mt-4 text-danger">
          {authErrorMessage(
            error,
            startGoogle.error
              ? "Couldn’t start Google sign-in. Try again or continue with email."
              : "Couldn’t send the sign-in email. Wait a moment and try again.",
          )}
        </Typography.Paragraph>
      ) : null}
    </AuthShell>
  );
}
