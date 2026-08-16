// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import {
  Button,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Typography,
} from "@namera-ai/ui";
import { Controller, useFormContext } from "react-hook-form";
import { useEventCallback } from "usehooks-ts";

import type { EmailFormInput, EmailFormOutput } from "./schema";

type EmailEntryProps = {
  errorMessage?: string | undefined;
  isPending: boolean;
  onBack: () => void;
  onContinue: (values: EmailFormOutput) => void;
};

export function EmailEntry({ errorMessage, isPending, onBack, onContinue }: EmailEntryProps) {
  const { control, handleSubmit } = useFormContext<EmailFormInput, unknown, EmailFormOutput>();
  const submit = useEventCallback((values: EmailFormOutput) => onContinue(values));
  const handleFormSubmit = handleSubmit(submit);

  return (
    <form
      className="grid gap-4"
      id="magic-link-request-form"
      noValidate
      onSubmit={handleFormSubmit}
    >
      <Typography.Heading className="mb-3 text-center text-balance text-xl" level={1}>
        What's your email address?
      </Typography.Heading>

      <FieldGroup>
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel className="sr-only" htmlFor="magic-link-email">
                Email address
              </FieldLabel>
              <Input
                {...field}
                id="magic-link-email"
                aria-invalid={fieldState.invalid}
                autoComplete="email"
                fullWidth
                inputMode="email"
                placeholder="richard@piedpiper.com"
                spellCheck={false}
                type="email"
                variant="secondary"
              />
              {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
            </Field>
          )}
        />
      </FieldGroup>

      <Button form="magic-link-request-form" fullWidth isDisabled={isPending} type="submit">
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
    </form>
  );
}
