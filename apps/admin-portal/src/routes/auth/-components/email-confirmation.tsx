// oxlint-disable react-perf/jsx-no-new-function-as-prop react-perf/jsx-no-new-array-as-prop
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Button, Field, FieldError, SignInCodeInput, Typography } from "@namera-ai/ui";
import { Controller, useForm } from "react-hook-form";

import { useVerifyMagicLink } from "@/hooks/auth";
import { authErrorMessage, finishSignIn } from "@/lib/auth-feedback";

import { type CodeForm, CodeValidator } from "./schema";

export function EmailConfirmation({ email, onBack }: { email: string; onBack: () => void }) {
  const form = useForm<typeof CodeForm.Encoded, unknown, typeof CodeForm.Type>({
    defaultValues: { email, code: "" },
    resolver: standardSchemaResolver(CodeValidator),
  });
  const verify = useVerifyMagicLink({ onSuccess: finishSignIn });
  return (
    <div className="text-center flex flex-col items-center justify-center">
      <Typography.Heading align="center" className="text-balance text-xl" level={1}>
        Check your email
      </Typography.Heading>
      <output className="mt-3 block">
        <Typography.Paragraph align="center" className="text-pretty" color="muted" size="sm">
          Use the sign-in link or enter the eight-digit code sent to{" "}
          <span className="text-foreground wrap-anywhere">{email}</span>
        </Typography.Paragraph>
      </output>
      <form
        id="admin-code-form"
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
              <SignInCodeInput
                {...field}
                aria-describedby={fieldState.error ? "admin-code-error" : undefined}
                isInvalid={fieldState.invalid}
                isDisabled={verify.isPending}
                onChange={(value) => {
                  field.onChange(value);
                  verify.reset();
                }}
              />
              <FieldError id="admin-code-error" errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Button
          className="mt-4"
          form="admin-code-form"
          fullWidth
          type="submit"
          isDisabled={verify.isPending}
        >
          {verify.isPending ? "Signing in..." : "Sign in"}
        </Button>
      </form>
      {verify.error ? (
        <Typography.Paragraph align="center" className="mt-3 text-danger" role="alert" size="sm">
          {authErrorMessage(
            verify.error,
            "Couldn’t sign in. Check your code or request a new email.",
          )}
        </Typography.Paragraph>
      ) : null}
      <Button
        className="mt-4"
        fullWidth
        variant="tertiary"
        isDisabled={verify.isPending}
        onPress={onBack}
      >
        Back to login
      </Button>
    </div>
  );
}
