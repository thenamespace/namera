import { useNavigate } from "@tanstack/react-router";

import type { ListSessionsResponse } from "@namera-ai/protocol/dto";
import { Button, Typography } from "@namera-ai/ui";
import { useEventCallback } from "usehooks-ts";

import { DataLoading } from "@/components/data-loading";
import { HeadingGroup } from "@/components/heading-group";
import { useLogout, useRevokeOtherSessions, useSessions } from "@/hooks/auth";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

import { SessionCard } from "./session-card";

type SecuritySessionsProps = {
  currentSessionId: ListSessionsResponse[number]["id"];
  initialSessions?: ListSessionsResponse;
};

export function SecuritySessions({ currentSessionId, initialSessions }: SecuritySessionsProps) {
  const navigate = useNavigate();
  const logout = useLogout({
    onError: (error) =>
      showErrorToast(error, {
        title: "Couldn’t log out",
        description: "This session is still active.",
      }),
    onSuccess: () => void navigate({ to: "/auth", replace: true }),
  });
  const revokeOthers = useRevokeOtherSessions({
    onError: (error) =>
      showErrorToast(error, {
        title: "Couldn’t log out other sessions",
        description: "Those sessions may still be active.",
      }),
    onSuccess: (count) =>
      showSuccessToast({
        title: count === 1 ? "Logged out 1 session" : `Logged out ${count} sessions`,
        description: "Your current session remains active.",
      }),
  });
  const sessions = useSessions();
  const sessionData = sessions.data ?? initialSessions ?? [];
  const isInitialLoading =
    sessions.isLoading && sessions.data === undefined && initialSessions === undefined;
  const otherSessionCount = sessionData.filter((session) => session.id !== currentSessionId).length;

  const handleLogout = useEventCallback(() => {
    logout.mutate();
  });

  const handleRevokeOthers = useEventCallback(() => {
    revokeOthers.mutate();
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
      {sessions.isError ? (
        <Typography className="text-danger">Couldn’t load your sessions.</Typography>
      ) : null}
      {isInitialLoading ? (
        <DataLoading className="min-h-64" label="Loading sessions" />
      ) : (
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
      )}
    </section>
  );
}
