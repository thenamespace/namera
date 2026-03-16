import { useForm } from "@tanstack/react-form";
import { useServerFn } from "@tanstack/react-start";

import { Email } from "@namera-ai/schema";
import { Button } from "@namera-ai/ui/components/ui/button";
import { Field, FieldError } from "@namera-ai/ui/components/ui/field";
import { Input } from "@namera-ai/ui/components/ui/input";
import { Schema } from "effect";

import { signInWithMagicLink } from "@/server/actions";

const AuthFormSchema = Schema.standardSchemaV1(
  Schema.Struct({
    email: Email,
  }),
);

type AuthForm = typeof AuthFormSchema.Encoded;

type MagicLinkFormProps = {
  onSubmit: (value: AuthForm) => void;
};

export const MagicLinkForm = ({ onSubmit }: MagicLinkFormProps) => {
  const signIn = useServerFn(signInWithMagicLink);
  const form = useForm({
    defaultValues: {
      email: "",
    },
    onSubmit: async ({ value }) => {
      await signIn({
        data: {
          email: value.email,
          name: "Vedant",
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 3000));
      onSubmit(value);
    },
    validators: {
      onSubmit: AuthFormSchema,
    },
  });

  return (
    <form
      className="w-full flex flex-col gap-3"
      id="auth-form"
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <div className="text-lg text-card-foreground text-center">
        Get started with Namera
      </div>
      <form.Field
        children={(field) => {
          const isInvalid =
            field.state.meta.isTouched && !field.state.meta.isValid;
          return (
            <Field data-invalid={isInvalid}>
              <Input
                aria-invalid={isInvalid}
                autoComplete="email"
                className="h-9"
                id={field.name}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="richard@piedpiper.com"
                spellCheck={false}
                value={field.state.value}
              />
              {isInvalid && <FieldError errors={field.state.meta.errors} />}
            </Field>
          );
        }}
        name="email"
      />
      <form.Subscribe
        children={({ canSubmit, isSubmitting }) => (
          <Button
            className="w-full"
            disabled={!canSubmit || isSubmitting}
            size="lg"
            type="submit"
          >
            Sign in with Email
          </Button>
        )}
      />
    </form>
  );
};
