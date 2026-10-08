// oxlint-disable react-perf/jsx-no-new-function-as-prop

import { createFileRoute } from "@tanstack/react-router";

import { Button, Typography } from "@namera-ai/ui";

import { useAcceptTeamInvitation } from "@/hooks/team";
import { teamErrorMessage } from "@/lib/team-feedback";
import { captureTeamInvitation, clearTeamInvitation } from "@/lib/team-invitation";

import { AuthShell } from "../auth/-components/auth-shell";

export const Route = createFileRoute("/invitations/accept")({
  loader: () => (typeof window === "undefined" ? null : captureTeamInvitation()),
  component: AcceptInvitation,
});

function AcceptInvitation() {
  const token = Route.useLoaderData();
  const accept = useAcceptTeamInvitation({
    onSuccess: () => {
      clearTeamInvitation();
      window.location.replace("/");
    },
  });
  return (
    <AuthShell stepKey="team-invitation">
      <div className="grid gap-4 text-center">
        <Typography.Heading align="center" level={1} className="text-xl" weight="medium">
          Join the admin team
        </Typography.Heading>
        {token ? (
          <>
            <Typography.Paragraph align="center" color="muted" size="sm">
              Sign in with the email address that received this invitation, then accept to join
              Namera Admin.
            </Typography.Paragraph>
            {accept.error ? (
              <p role="alert" className="text-danger text-sm">
                {teamErrorMessage(accept.error)}
              </p>
            ) : null}
            <Button
              fullWidth
              isDisabled={accept.isPending}
              onPress={() => accept.mutate({ payload: { token } })}
            >
              {accept.isPending ? "Joining…" : "Accept invitation"}
            </Button>
            <Button
              fullWidth
              variant="tertiary"
              isDisabled={accept.isPending}
              onPress={() => window.location.assign("/auth?reauth=true")}
            >
              Sign in with your team email
            </Button>
            <Button
              fullWidth
              variant="ghost"
              isDisabled={accept.isPending}
              onPress={() => {
                clearTeamInvitation();
                window.location.replace("/auth");
              }}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Typography.Paragraph align="center" color="muted" size="sm">
            This invitation link is incomplete. Open the link in your invitation email or ask the
            owner for a new one.
          </Typography.Paragraph>
        )}
      </div>
    </AuthShell>
  );
}
