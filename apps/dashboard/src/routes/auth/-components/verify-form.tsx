import { Schema } from "effect";

import { GetMagicLinkRequest } from "@namera-ai/protocol/dto";
import { Button, buttonVariants, cn, Link, Typography } from "@namera-ai/ui";
import { NameraIcon } from "@namera-ai/ui/icons";
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
  const isValidLink = Schema.is(GetMagicLinkRequest)(search);
  const verifyMagicLink = useVerifyMagicLink({
    onSuccess: (response) => window.location.replace(response.body.returnTo),
  });

  const verify = useEventCallback(() => {
    if (!isValidLink) return;

    verifyMagicLink.mutate({
      payload: { type: "token", id: search.id, token: search.token },
    });
  });

  const errorMessage = !isValidLink
    ? "This sign-in link is invalid. Request a new link to continue."
    : verifyMagicLink.isError
      ? "We couldn't verify this sign-in link. It may be invalid or expired."
      : undefined;

  return (
    <AuthShell stepKey="verify-magic-link">
      <div className="text-center flex flex-col items-center justify-center">
        <NameraIcon aria-hidden="true" className="fill-foreground mx-auto mb-10 h-10 w-auto" />
        <Typography.Heading className="text-balance text-xl" level={1}>
          Sign in to Namera?
        </Typography.Heading>
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
        <Link
          className={cn(buttonVariants({ variant: "ghost" }), "mt-2 w-full") as string}
          href="/auth"
        >
          Cancel
        </Link>
      </div>
    </AuthShell>
  );
}
