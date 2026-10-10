import type { SessionKeyId } from "@namera-ai/protocol";
import type { NotificationResponse } from "@namera-ai/protocol/dto";

import { SessionKeyCustodyDisplay } from "@/components/display/session-key-custody-display";
import { hasPermissions } from "@/components/permission";
import { useCurrentUser } from "@/hooks/auth";
import { useSessionKey } from "@/hooks/session-key";

type SessionNotification = Extract<
  NotificationResponse["notification"],
  { type: "session_key.created" | "session_key.revoked" }
>;

function ExistingSessionCustody({ id }: { id: SessionKeyId }) {
  const session = useSessionKey(id);
  if (!session.data)
    return (
      <span className="text-muted">{session.isPending ? "Loading custody…" : "Not recorded"}</span>
    );
  return <SessionKeyCustodyDisplay custody={session.data.signer.custody} />;
}

export function SessionNotificationCustody({
  notification,
}: {
  notification: SessionNotification;
}) {
  const user = useCurrentUser();
  if (notification.data.custody) {
    return (
      <SessionKeyCustodyDisplay
        custody={notification.data.custody}
        provider={notification.data.provider ?? "namera"}
      />
    );
  }
  // Older notifications have no snapshot. Only read the resource in the current authorized org.
  if (
    user.data?.organization.id === notification.organizationId &&
    hasPermissions(user.data.role.permissions, ["session-key:read"])
  ) {
    return <ExistingSessionCustody id={notification.resourceId} />;
  }
  return <span className="text-muted">Not recorded</span>;
}
