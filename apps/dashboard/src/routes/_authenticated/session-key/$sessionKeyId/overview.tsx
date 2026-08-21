import { createFileRoute } from "@tanstack/react-router";

import { DataLoading } from "@/components/data-loading";
import { useSessionKey } from "@/hooks/session-key";

import { SessionKeyOverview } from "../-components/session-key-overview";
import { Route as SessionKeyRoute } from "./route";

export const Route = createFileRoute("/_authenticated/session-key/$sessionKeyId/overview")({
  component: SessionKeyOverviewPage,
});

function SessionKeyOverviewPage() {
  const { sessionKeyId } = SessionKeyRoute.useLoaderData();
  const sessionKey = useSessionKey(sessionKeyId);
  return sessionKey.data ? (
    <SessionKeyOverview sessionKey={sessionKey.data} />
  ) : (
    <DataLoading className="min-h-64" label="Loading session key" />
  );
}
