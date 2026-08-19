import { createFileRoute } from "@tanstack/react-router";

import { SessionKeyPolicies } from "../-components/session-key-policies";
import { Route as SessionKeyRoute } from "./route";

export const Route = createFileRoute("/_authenticated/session-key/$sessionKeyId/policies")({
  component: SessionKeyPoliciesPage,
});

function SessionKeyPoliciesPage() {
  const { sessionKey } = SessionKeyRoute.useLoaderData();
  return <SessionKeyPolicies sessionKey={sessionKey} />;
}
