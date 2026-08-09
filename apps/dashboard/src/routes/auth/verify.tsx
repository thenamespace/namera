import { useCallback, useMemo } from "react";

import { createFileRoute } from "@tanstack/react-router";

import { Option, Schema } from "effect";

import { GetMagicLinkRequest } from "@namera-ai/protocol/dto";
import { Alert, Button, Card, Chip, Link, Spinner, Typography } from "@namera-ai/ui";
import {
  ArrowLeft02Icon,
  ArrowRight02Icon,
  CheckmarkCircle02Icon,
  HugeiconsIcon,
  Shield01Icon,
} from "@namera-ai/ui/icons";

import { AuthShell } from "@/components/auth-shell";
import { useVerifyMagicLink } from "@/hooks";

export const Route = createFileRoute("/auth/verify")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search.id === "string" ? search.id : undefined,
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: VerifyMagicLink,
});

function VerifyMagicLink() {
  const search = Route.useSearch();
  const verifyMagicLink = useVerifyMagicLink();
  const verifyMagicLinkAsync = verifyMagicLink.mutateAsync;
  const verification = useMemo(
    () => Schema.decodeUnknownOption(GetMagicLinkRequest)(search),
    [search],
  );

  const handleVerify = useCallback(async () => {
    if (Option.isNone(verification)) {
      return;
    }

    try {
      const response = await verifyMagicLinkAsync({
        payload: {
          type: "token",
          id: verification.value.id,
          token: verification.value.token,
        },
      });
      window.location.replace(response.body.returnTo);
    } catch {
      // The mutation renders its typed failure state below the consent card.
    }
  }, [verification, verifyMagicLinkAsync]);

  if (Option.isNone(verification)) {
    return (
      <AuthShell>
        <Card>
          <Card.Header>
            <Chip color="danger" variant="soft">
              <Chip.Label>Invalid link</Chip.Label>
            </Chip>
          </Card.Header>
          <Card.Content>
            <Typography.Heading level={1}>This Sign-In Link Is Incomplete</Typography.Heading>
            <Card.Description className="mt-2 text-pretty">
              Request a new email to continue. Make sure you open the complete link from your inbox.
            </Card.Description>
          </Card.Content>
          <Card.Footer>
            <Link
              className="bg-default text-default-foreground hover:bg-default-hover focus-visible:ring-accent inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium no-underline focus-visible:ring-2 focus-visible:ring-offset-2"
              href="/auth"
            >
              <HugeiconsIcon aria-hidden="true" icon={ArrowLeft02Icon} size={18} />
              Request a New Link
            </Link>
          </Card.Footer>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="mb-8">
        <Chip color="success" variant="soft">
          <Chip.Label className="flex items-center gap-1.5">
            <HugeiconsIcon aria-hidden="true" icon={CheckmarkCircle02Icon} size={15} />
            Link verified
          </Chip.Label>
        </Chip>
        <Typography.Heading className="mt-5 text-balance" level={1}>
          Continue to Namera
        </Typography.Heading>
        <Typography.Paragraph className="mt-3 text-pretty" color="muted">
          Confirm that you want to create an authenticated session in this browser.
        </Typography.Paragraph>
      </div>

      <Card>
        <Card.Header>
          <span className="bg-accent-soft text-accent-soft-foreground grid size-11 place-items-center rounded-xl">
            <HugeiconsIcon aria-hidden="true" icon={Shield01Icon} size={22} />
          </span>
        </Card.Header>
        <Card.Content>
          <Typography.Heading level={2}>Browser Session</Typography.Heading>
          <Card.Description className="mt-2 text-pretty">
            Namera will store a secure, HTTP-only session cookie. No wallet permissions are granted
            by signing in.
          </Card.Description>
        </Card.Content>
        <Card.Footer className="grid gap-3 sm:grid-cols-2">
          <Link
            className="bg-default text-default-foreground hover:bg-default-hover focus-visible:ring-accent inline-flex min-h-10 items-center justify-center rounded-lg px-4 text-sm font-medium no-underline focus-visible:ring-2 focus-visible:ring-offset-2"
            href="/auth"
          >
            Cancel
          </Link>
          <Button isDisabled={verifyMagicLink.isPending} onPress={handleVerify}>
            {verifyMagicLink.isPending ? (
              <>
                <Spinner size="sm" /> Signing in…
              </>
            ) : (
              <>
                Sign In to Namera
                <HugeiconsIcon aria-hidden="true" icon={ArrowRight02Icon} size={18} />
              </>
            )}
          </Button>
        </Card.Footer>
      </Card>

      {verifyMagicLink.isError ? (
        <Alert className="mt-4" status="danger" role="alert">
          <Alert.Content>
            <Alert.Title>This link could not be verified</Alert.Title>
            <Alert.Description>
              It may have expired or already been used. Request a new sign-in email.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
    </AuthShell>
  );
}
