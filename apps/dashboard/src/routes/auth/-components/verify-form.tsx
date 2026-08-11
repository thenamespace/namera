import { Button, Link, Typography } from "@namera-ai/ui";

import { AuthShell } from "./auth-shell";

export function VerifyForm() {
  return (
    <AuthShell stepKey="verify-magic-link">
      <div className="text-center">
        <Typography.Heading className="text-balance text-xl" level={1}>
          Sign in to Namera?
        </Typography.Heading>
        <Typography.Paragraph className="mt-3 text-pretty" color="muted" size="sm">
          We've sent you a temporary login link. Please check your inbox
        </Typography.Paragraph>

        <Button className="mt-8" fullWidth>
          Continue
        </Button>
        <Link className="mt-5 inline-flex" href="/auth">
          Cancel
        </Link>
      </div>
    </AuthShell>
  );
}
