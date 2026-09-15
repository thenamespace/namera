// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  Button,
  Field,
  FieldError,
  FieldLabel,
  InputOTP,
  REGEXP_ONLY_DIGITS,
  Typography,
} from "@namera-ai/ui";
import { Controller, useForm } from "react-hook-form";

import { useVerifyMagicLink } from "@/hooks/auth";
import { getErrorMessage } from "@/lib/error-messages";

import { EmailCodeValidator, type EmailCodeInput, type EmailCodeOutput } from "./email-code-schema";

type EmailConfirmationProps = {
  email: string;
  onBack: () => void;
};

export function EmailConfirmation({ email, onBack }: EmailConfirmationProps) {
  const form = useForm<EmailCodeInput, unknown, EmailCodeOutput>({
    defaultValues: { email, code: "" },
    resolver: standardSchemaResolver(EmailCodeValidator),
  });
  const verify = useVerifyMagicLink({
    onSuccess: (response) => window.location.replace(response.body.returnTo),
  });
  return (
    <div className="text-center flex flex-col items-center justify-center">
      <Typography.Heading className="text-balance text-xl" level={1}>
        Check your email
      </Typography.Heading>
      <output className="mt-3 block">
        <Typography.Paragraph className="text-pretty" color="muted" size="sm">
          Use the sign-in link or enter the eight-digit code sent to
          <span className="text-foreground mt-1 block text-center">{email}</span>
        </Typography.Paragraph>
      </output>
      <form
        id="email-code-form"
        className="mt-6 w-full"
        noValidate
        onSubmit={form.handleSubmit((payload) =>
          verify.mutate({ payload: { type: "code", ...payload } }),
        )}
      >
        <Controller
          control={form.control}
          name="code"
          render={({ field, fieldState }) => (
            <Field className="justify-items-center">
              <FieldLabel htmlFor="email-signin-code">Email sign-in code</FieldLabel>
              <InputOTP
                {...field}
                id="email-signin-code"
                aria-label="Email sign-in code"
                aria-describedby={fieldState.error ? "email-code-error" : undefined}
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={8}
                pattern={REGEXP_ONLY_DIGITS}
                variant="secondary"
                isInvalid={fieldState.invalid}
                isDisabled={verify.isPending}
                onChange={(value) => {
                  field.onChange(value);
                  verify.reset();
                }}
              >
                <InputOTP.Group className="gap-1">
                  {[0, 1, 2, 3].map((index) => (
                    <InputOTP.Slot key={index} index={index} className="h-10 w-6 min-[380px]:w-8" />
                  ))}
                </InputOTP.Group>
                <InputOTP.Separator />
                <InputOTP.Group className="gap-1">
                  {[4, 5, 6, 7].map((index) => (
                    <InputOTP.Slot key={index} index={index} className="h-10 w-6 min-[380px]:w-8" />
                  ))}
                </InputOTP.Group>
              </InputOTP>
              <FieldError id="email-code-error" errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Button
          className="mt-4"
          form="email-code-form"
          fullWidth
          type="submit"
          isDisabled={verify.isPending}
        >
          {verify.isPending ? "Signing in..." : "Sign in"}
        </Button>
        {verify.isError ? (
          <Typography.Paragraph className="mt-3 text-danger" role="alert" size="sm">
            {
              getErrorMessage(verify.error, {
                title: "Couldn’t sign in",
                description: "Check your code or request a new email.",
              }).description
            }
          </Typography.Paragraph>
        ) : null}
      </form>

      <Button
        className="mt-4"
        fullWidth
        isDisabled={verify.isPending}
        onPress={onBack}
        variant="tertiary"
      >
        Back to login
      </Button>
    </div>
  );
}
