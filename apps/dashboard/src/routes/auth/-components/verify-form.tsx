import { Schema } from "effect";

import { GetMagicLinkRequest } from "@namera-ai/protocol/dto";
import { Button, Link, Typography } from "@namera-ai/ui";
import { useEventCallback } from "usehooks-ts";

import { useVerifyMagicLink } from "@/hooks/auth";

import { AuthShell } from "./auth-shell";

type VerifyFormProps = {
  search: {
    id?: string;
    token?: string;
  };
};

export function VerifyForm({ search }: VerifyFormProps) {
  const verifyMagicLink = useVerifyMagicLink();
  const isValidLink = Schema.is(GetMagicLinkRequest)(search);

  const verify = useEventCallback(async () => {
    if (!isValidLink) return;

    try {
      const response = await verifyMagicLink.mutateAsync({
        payload: { type: "token", id: search.id, token: search.token },
      });
      window.location.replace(response.body.returnTo);
    } catch {
      return;
    }
  });

  const errorMessage = !isValidLink
    ? "This sign-in link is invalid. Request a new link to continue."
    : verifyMagicLink.isError
      ? "We couldn’t verify this sign-in link. It may be invalid or expired."
      : undefined;

  return (
    <AuthShell stepKey="verify-magic-link">
      <div className="text-center">
        <Typography.Heading className="text-balance text-xl" level={1}>
          Sign in to Namera?
        </Typography.Heading>
        <Typography.Paragraph className="mt-3 text-pretty" color="muted" size="sm">
          We've sent you a temporary login link. Please check your inbox
        </Typography.Paragraph>

        <Button
          className="mt-8"
          fullWidth
          isDisabled={!isValidLink || verifyMagicLink.isPending}
          onPress={verify}
        >
          {verifyMagicLink.isPending ? "Signing in..." : "Continue"}
        </Button>
        {errorMessage ? (
          <Typography.Paragraph className="text-danger mt-4" role="alert" size="sm">
            {errorMessage}
          </Typography.Paragraph>
        ) : null}
        <Link className="mt-5 inline-flex" href="/auth">
          Cancel
        </Link>
      </div>
    </AuthShell>
  );
}
