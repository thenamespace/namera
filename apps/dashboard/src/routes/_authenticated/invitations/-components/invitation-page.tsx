import { type ReactNode, useState } from "react";

import { useNavigate } from "@tanstack/react-router";

import { DateTime } from "effect";

import type { GetInvitationResponse } from "@namera-ai/protocol/dto";
import type { MetadataIcon } from "@namera-ai/protocol/model";
import { Button, IconPreview, Typography } from "@namera-ai/ui";
import { useEventCallback } from "usehooks-ts";

import { useAcceptInvitation, useRejectInvitation } from "@/hooks/auth";

const defaultOrganizationLogo: MetadataIcon = { type: "emoji", value: "🏢" };
const defaultUserImage: MetadataIcon = { type: "emoji", value: "👤" };

type InvitationPageProps = {
  initialInvitation: GetInvitationResponse | null;
};

type InvitationViewState =
  | GetInvitationResponse["invitation"]["status"]
  | "already-member"
  | "unavailable";

const stateCopy: Record<
  Exclude<InvitationViewState, "pending"> | "not-found",
  { title: string; description: string }
> = {
  accepted: {
    title: "Invitation accepted",
    description: "You already accepted this invitation.",
  },
  "already-member": {
    title: "Already a member",
    description: "You already belong to this workspace.",
  },
  canceled: {
    title: "Invitation canceled",
    description: "This invitation was canceled by the workspace.",
  },
  expired: {
    title: "Invitation expired",
    description: "Ask a workspace member to send you a new invitation.",
  },
  "not-found": {
    title: "Invitation not found",
    description: "This invitation does not exist or is no longer available.",
  },
  rejected: {
    title: "Invitation declined",
    description: "You declined this workspace invitation.",
  },
  unavailable: {
    title: "Invitation unavailable",
    description: "This invitation changed or is no longer available.",
  },
};

export function InvitationPage({ initialInvitation }: InvitationPageProps) {
  const navigate = useNavigate();
  const acceptInvitation = useAcceptInvitation();
  const rejectInvitation = useRejectInvitation();
  const initialState =
    initialInvitation?.invitation.status === "pending" &&
    DateTime.toEpochMillis(initialInvitation.invitation.expiresAt) <= Date.now()
      ? "expired"
      : initialInvitation?.invitation.status;
  const [state, setState] = useState<InvitationViewState | "not-found">(
    initialState ?? "not-found",
  );
  const [errorMessage, setErrorMessage] = useState<string>();
  const isPending = acceptInvitation.isPending || rejectInvitation.isPending;

  const accept = useEventCallback(async () => {
    if (initialInvitation === null) return;
    setErrorMessage(undefined);
    try {
      await acceptInvitation.mutateAsync({
        payload: { invitationId: initialInvitation.invitation.id },
      });
      setState("accepted");
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error) {
        if (error.code === "ALREADY_A_MEMBER") {
          setState("already-member");
          return;
        }
        if (error.code === "INVITATION_NOT_FOUND") {
          setState("unavailable");
          return;
        }
      }
      setErrorMessage("Could not accept the invitation. Try again.");
    }
  });

  const reject = useEventCallback(async () => {
    if (initialInvitation === null) return;
    setErrorMessage(undefined);
    try {
      await rejectInvitation.mutateAsync({
        payload: { invitationId: initialInvitation.invitation.id },
      });
      setState("rejected");
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "INVITATION_NOT_FOUND"
      ) {
        setState("unavailable");
        return;
      }
      setErrorMessage("Could not decline the invitation. Try again.");
    }
  });

  const goHome = useEventCallback(() => navigate({ to: "/" }));

  if (initialInvitation === null || state !== "pending") {
    const copy = stateCopy[state === "pending" ? "unavailable" : state];
    return (
      <InvitationShell>
        <Typography.Heading className="text-center text-xl" level={1}>
          {copy.title}
        </Typography.Heading>
        <Typography.Paragraph className="text-muted mt-3 text-center text-balance" size="sm">
          {copy.description}
        </Typography.Paragraph>
        <Button className="mt-8" fullWidth onPress={goHome}>
          Go to dashboard
        </Button>
      </InvitationShell>
    );
  }

  const organizationName = initialInvitation.organization.metadata.name;
  const inviterName = initialInvitation.inviter.metadata.name ?? initialInvitation.inviter.email;
  const roleName = initialInvitation.organizationRole.metadata.name;

  return (
    <InvitationShell>
      <IconPreview
        className="mx-auto mb-8"
        size="lg"
        value={initialInvitation.organization.metadata.logo ?? defaultOrganizationLogo}
      />
      <Typography.Heading className="text-center text-balance text-xl" level={1}>
        Join {organizationName}
      </Typography.Heading>
      <Typography.Paragraph className="text-muted mt-3 text-center text-balance" size="sm">
        You have been invited to join as {roleName}.
      </Typography.Paragraph>

      <div className="mt-8 flex items-center justify-center gap-2">
        <IconPreview
          size="xs"
          value={initialInvitation.inviter.metadata.image ?? defaultUserImage}
        />
        <Typography.Paragraph size="sm">Invited by {inviterName}</Typography.Paragraph>
      </div>

      <div className="mt-8 grid gap-3">
        <Button fullWidth isDisabled={isPending} onPress={accept}>
          {acceptInvitation.isPending ? "Accepting..." : "Accept invitation"}
        </Button>
        <Button fullWidth isDisabled={isPending} onPress={reject} variant="tertiary">
          {rejectInvitation.isPending ? "Declining..." : "Decline"}
        </Button>
      </div>
      {errorMessage ? (
        <Typography.Paragraph className="text-danger mt-4 text-center" role="alert" size="sm">
          {errorMessage}
        </Typography.Paragraph>
      ) : null}
    </InvitationShell>
  );
}

function InvitationShell({ children }: { children: ReactNode }) {
  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-xs">{children}</div>
    </main>
  );
}
