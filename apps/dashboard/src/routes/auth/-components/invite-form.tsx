// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-function-as-prop
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Button, Field, FieldError, FieldLabel, Input, Link, Typography } from "@namera-ai/ui";
import { NameraIcon } from "@namera-ai/ui/icons";
import { Controller, useForm } from "react-hook-form";

import { useRedeemBetaInvite } from "@/hooks/auth";
import { getErrorMessage } from "@/lib/error-messages";

import { AuthShell } from "./auth-shell";
import { InviteFormValidator, type InviteFormInput } from "./invite-schema";

export function InviteForm() {
  const form = useForm<InviteFormInput>({
    defaultValues: { inviteCode: "" },
    resolver: standardSchemaResolver(InviteFormValidator),
  });
  const redeem = useRedeemBetaInvite({
    onSuccess: (response) => window.location.replace(response.body.returnTo),
  });
  return (
    <AuthShell stepKey="beta-invite">
      <NameraIcon aria-hidden="true" className="fill-foreground mx-auto mb-10 h-10 w-auto" />
      <Typography.Heading level={1} className="text-center text-xl">
        Enter your invite code
      </Typography.Heading>
      <Typography.Paragraph className="mt-3 text-center" color="muted" size="sm">
        Namera is in private beta. Enter the code your teammate shared to continue.
      </Typography.Paragraph>
      <form
        id="beta-invite-form"
        noValidate
        className="mt-6 grid gap-4"
        onSubmit={form.handleSubmit((payload) => redeem.mutate({ payload }))}
      >
        <Controller
          control={form.control}
          name="inviteCode"
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor="beta-invite-code">Invite code</FieldLabel>
              <Input
                {...field}
                id="beta-invite-code"
                variant="secondary"
                fullWidth
                maxLength={6}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="Six-character code"
                aria-invalid={fieldState.invalid}
                aria-describedby={fieldState.error ? "beta-invite-error" : undefined}
                disabled={redeem.isPending}
                onChange={(event) => {
                  field.onChange(event.target.value.trim().toUpperCase());
                  redeem.reset();
                }}
              />
              <FieldError id="beta-invite-error" errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Button form="beta-invite-form" type="submit" fullWidth isDisabled={redeem.isPending}>
          {redeem.isPending ? "Joining..." : "Join Namera"}
        </Button>
        {redeem.isError ? (
          <Typography.Paragraph role="alert" size="sm" className="text-danger text-center">
            {
              getErrorMessage(redeem.error, {
                title: "Couldn’t accept invite",
                description: "Check your invite or sign in again.",
              }).description
            }
          </Typography.Paragraph>
        ) : null}
      </form>
      <Typography.Paragraph className="mt-5 text-center" color="muted" size="sm">
        <Link href="/auth">Sign in again</Link> if your verification has expired.
      </Typography.Paragraph>
    </AuthShell>
  );
}
