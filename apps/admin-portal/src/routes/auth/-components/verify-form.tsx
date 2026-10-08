import { useCallback } from "react";

import { Schema } from "effect";

import { GetMagicLinkRequest } from "@namera-ai/protocol/dto";
import { Button, buttonVariants, cn, Typography, Link } from "@namera-ai/ui";

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
    <AuthShell stepKey="verify-magic-link">
      <div className="text-center flex flex-col items-center justify-center">
        <Typography.Heading align="center" className="text-balance text-xl" level={1}>
          Sign in to Namera Admin?
        </Typography.Heading>
        <Button className="mt-8" fullWidth isDisabled={!valid || verify.isPending} onPress={submit}>
          {verify.isPending ? "Signing in..." : "Continue"}
        </Button>
        {!valid || verify.error ? (
          <Typography.Paragraph align="center" role="alert" className="text-danger mt-4" size="sm">
            {authErrorMessage(
              verify.error,
              "This sign-in link is invalid or expired. Request a new email.",
            )}
          </Typography.Paragraph>
        ) : null}
        <Link
          href="/auth"
          className={cn(buttonVariants({ variant: "ghost" }), "mt-2 w-full") as string}
        >
          Cancel
        </Link>
      </div>
    </AuthShell>
  );
}
