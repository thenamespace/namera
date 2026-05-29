import { Schema, Struct } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useForm, Controller } from "react-hook-form";

import { useSignInWithMagicLink } from "@/hooks/auth";
import { Email } from "@namera-ai/schema";
import { SigInMagicLinkBody } from "@namera-ai/schema/dto";
import { Button } from "@namera-ai/ui/components/ui/button";
import { Field, FieldError } from "@namera-ai/ui/components/ui/field";
import { Input } from "@namera-ai/ui/components/ui/input";

const AuthFormSchema = SigInMagicLinkBody.mapFields(Struct.pick(["email"]));

type AuthForm = typeof AuthFormSchema.Type;

type MagicLinkFormProps = {
  onSubmit: (value: AuthForm) => void;
};

export const MagicLinkForm = ({ onSubmit }: MagicLinkFormProps) => {
  const { mutateAsync } = useSignInWithMagicLink();
  const form = useForm({
    defaultValues: {
      email: "",
    },
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(AuthFormSchema)),
  });

  const handleSubmit = async (value: AuthForm) => {
    await mutateAsync({
      email: Email.make(value.email),
    });
    onSubmit(value);
  };

  return (
    <form
      className="flex w-full flex-col gap-3"
      id="auth-form"
      onSubmit={form.handleSubmit(handleSubmit)}
    >
      <div className="text-center text-lg font-medium">
        Get started with Namera
      </div>
      <Controller
        render={({ field, fieldState }) => {
          const isInvalid = fieldState.invalid;
          return (
            <Field data-invalid={isInvalid}>
              <Input
                aria-invalid={isInvalid}
                autoComplete="email"
                className="h-9"
                id={field.name}
                {...field}
                placeholder="richard@piedpiper.com"
                spellCheck={false}
              />
              {isInvalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          );
        }}
        control={form.control}
        name="email"
      />
      <Button
        className="w-full"
        disabled={form.formState.isSubmitting}
        size="lg"
        type="submit"
      >
        Sign in with Email
      </Button>
    </form>
  );
};
