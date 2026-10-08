import { useCallback } from "react";

import { Schema } from "effect";

import { GetMagicLinkRequest } from "@namera-ai/protocol/dto";
import { Button, Typography, Link } from "@namera-ai/ui";

import { useVerifyMagicLink } from "@/hooks/auth";
import { authErrorMessage, finishSignIn } from "@/lib/auth-feedback";

import { AuthShell } from "./auth-shell";

export function VerifyForm({ search }: { search: { id?: string; token?: string } }) {
  const valid = Schema.is(GetMagicLinkRequest)(search);
  const verify = useVerifyMagicLink({ onSuccess: finishSignIn });
  const { mutate } = verify;
  const submit = useCallback(() => {
    if (valid) mutate({ payload: { type: "token", ...search } });
  }, [valid, mutate, search]);
  return (
    <AuthShell>
      <div className="grid gap-4 text-center">
        <Typography.Heading className="mb-3 text-xl" level={1}>
          Sign in to Namera Admin?
        </Typography.Heading>
        <Button fullWidth isDisabled={!valid} isPending={verify.isPending} onPress={submit}>
          {verify.isPending ? "Signing in..." : "Continue"}
        </Button>
        {!valid || verify.error ? (
          <Typography.Paragraph role="alert" className="text-danger" size="sm">
            {authErrorMessage(
              verify.error,
              "This sign-in link is invalid or expired. Request a new email.",
            )}
          </Typography.Paragraph>
        ) : null}
        <Link href="/auth" className="py-3">
          Back to login
        </Link>
      </div>
    </AuthShell>
  );
}
