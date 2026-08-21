import { createFileRoute, redirect } from "@tanstack/react-router";

import { apiKeysAtom } from "@/atoms/api-key";
import { currentUserAtom } from "@/atoms/auth/session";
import { prefetchQuery, startPrefetchQuery } from "@/atoms/prefetch";
import { sessionKeysAtom } from "@/atoms/session-key";
import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";
import { hasPermissions } from "@/components/permission";
import { PermissionDenied } from "@/components/permission-denied";

import { ApiKeysTable } from "../-components/api-keys-table";

const apiKeyCreatePermission = ["api-key:create"] as const;
const apiKeyReadPermission = ["api-key:read"] as const;
const apiKeyRevokePermission = ["api-key:revoke"] as const;

export const Route = createFileRoute("/_authenticated/settings/workspace/api-keys")({
  loader: async ({ abortController, context }) => {
    const currentUser = await prefetchQuery(
      context.atomRegistry,
      currentUserAtom,
      abortController.signal,
    );
    if (currentUser === null) throw redirect({ to: "/auth", replace: true });

    const canRead = hasPermissions(currentUser.role.permissions, apiKeyReadPermission);
    const canCreate = hasPermissions(currentUser.role.permissions, apiKeyCreatePermission);
    const canRevoke = hasPermissions(currentUser.role.permissions, apiKeyRevokePermission);
    if (canRead) startPrefetchQuery(context.atomRegistry, apiKeysAtom, abortController.signal);
    if (canCreate)
      startPrefetchQuery(context.atomRegistry, sessionKeysAtom, abortController.signal);

    return { canCreate, canRead, canRevoke };
  },
  component: ApiKeysPage,
});

function ApiKeysPage() {
  const { canCreate, canRead, canRevoke } = Route.useLoaderData();

  return (
    <DashboardPage>
      <DashboardPage.Header className="md:hidden">
        <DashboardPage.Title />
      </DashboardPage.Header>
      <DashboardPage.Content className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-12 md:py-16">
        <HeadingGroup className="mb-8">
          <HeadingGroup.Title level={1} size="lg">
            API keys
          </HeadingGroup.Title>
          <HeadingGroup.Description>
            Grant external clients access through selected session keys.
          </HeadingGroup.Description>
        </HeadingGroup>
        {canRead ? (
          <ApiKeysTable canCreate={canCreate} canRevoke={canRevoke} />
        ) : (
          <PermissionDenied />
        )}
      </DashboardPage.Content>
    </DashboardPage>
  );
}
