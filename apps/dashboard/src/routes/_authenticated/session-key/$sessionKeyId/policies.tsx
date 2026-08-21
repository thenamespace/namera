import { createFileRoute } from "@tanstack/react-router";

import { DataLoading } from "@/components/data-loading";
import { useSessionKey } from "@/hooks/session-key";

import { SessionKeyPolicies } from "../-components/session-key-policies";
import { Route as SessionKeyRoute } from "./route";

export const Route = createFileRoute("/_authenticated/session-key/$sessionKeyId/policies")({
  component: SessionKeyPoliciesPage,
});

function SessionKeyPoliciesPage() {
  const { sessionKeyId } = SessionKeyRoute.useLoaderData();
  const sessionKey = useSessionKey(sessionKeyId);
  return sessionKey.data ? (
    <SessionKeyPolicies sessionKey={sessionKey.data} />
  ) : (
    <DataLoading className="min-h-64" label="Loading policies" />
  );
}
