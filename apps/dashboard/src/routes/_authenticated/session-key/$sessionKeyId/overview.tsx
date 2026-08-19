import { createFileRoute } from "@tanstack/react-router";

import { useSessionKey } from "@/hooks/session-key";

import { SessionKeyOverview } from "../-components/session-key-overview";
import { Route as SessionKeyRoute } from "./route";

export const Route = createFileRoute("/_authenticated/session-key/$sessionKeyId/overview")({
  component: SessionKeyOverviewPage,
});

function SessionKeyOverviewPage() {
  const { sessionKey } = SessionKeyRoute.useLoaderData();
  const currentSessionKey = useSessionKey(sessionKey.id);
  return <SessionKeyOverview sessionKey={currentSessionKey.data ?? sessionKey} />;
}
