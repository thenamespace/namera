import { useNavigate } from "@tanstack/react-router";

import type { ListSessionsResponse } from "@namera-ai/protocol/dto";
import { Button, Typography, toast } from "@namera-ai/ui";
import { useEventCallback } from "usehooks-ts";

import { HeadingGroup } from "@/components/heading-group";
import { useLogout, useRevokeOtherSessions, useSessions } from "@/hooks/auth";

import { SessionCard } from "./session-card";

type SecuritySessionsProps = {
  currentSessionId: ListSessionsResponse[number]["id"];
  initialSessions: ListSessionsResponse;
};

export function SecuritySessions({ currentSessionId, initialSessions }: SecuritySessionsProps) {
  const logout = useLogout();
  const revokeOthers = useRevokeOtherSessions();
  const sessions = useSessions();
  const navigate = useNavigate();
  const sessionData = sessions.data ?? initialSessions;
  const otherSessionCount = sessionData.filter((session) => session.id !== currentSessionId).length;

  const handleLogout = useEventCallback(async () => {
    try {
      await logout.mutateAsync();
      await navigate({ to: "/auth", replace: true });
    } catch {
      toast.danger("Couldn’t log out this session.");
    }
  });

  const handleRevokeOthers = useEventCallback(async () => {
    try {
      const count = await revokeOthers.mutateAsync();
      toast.success(
        count === 1 ? "Logged out 1 other session" : `Logged out ${count} other sessions`,
      );
    } catch {
      toast.danger("Couldn’t log out other sessions.");
    }
  });

  return (
    <section aria-labelledby="sessions-heading">
      <div className="mb-4 flex items-end justify-between gap-4">
        <HeadingGroup>
          <HeadingGroup.Title id="sessions-heading">Sessions</HeadingGroup.Title>
          <HeadingGroup.Description>
            Manage the browsers and devices signed in to your account.
          </HeadingGroup.Description>
        </HeadingGroup>
        {otherSessionCount > 0 ? (
          <Button
            isDisabled={revokeOthers.isPending}
            onPress={handleRevokeOthers}
            size="sm"
            variant="danger-soft"
          >
            {revokeOthers.isPending ? "Logging out…" : "Log out other sessions"}
          </Button>
        ) : null}
      </div>
      {sessions.isLoading ? <Typography color="muted">Loading sessions…</Typography> : null}
      {sessions.isError ? (
        <Typography className="text-danger">Couldn’t load your sessions.</Typography>
      ) : null}
      <ul className="space-y-2">
        {sessionData.map((session) => (
          <li key={session.id}>
            <SessionCard
              isCurrent={session.id === currentSessionId}
              isLoggingOut={logout.isPending}
              onLogout={session.id === currentSessionId ? handleLogout : undefined}
              session={session}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
