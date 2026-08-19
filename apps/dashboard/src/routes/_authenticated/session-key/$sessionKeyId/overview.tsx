import { createFileRoute } from "@tanstack/react-router";

import { SessionKeyOverview } from "../-components/session-key-overview";
import { Route as SessionKeyRoute } from "./route";

export const Route = createFileRoute("/_authenticated/session-key/$sessionKeyId/overview")({
  component: SessionKeyOverviewPage,
});

function SessionKeyOverviewPage() {
  const { sessionKey } = SessionKeyRoute.useLoaderData();
  return <SessionKeyOverview sessionKey={sessionKey} />;
}
