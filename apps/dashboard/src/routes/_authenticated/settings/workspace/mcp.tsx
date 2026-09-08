import { createFileRoute, redirect } from "@tanstack/react-router";

import { mcpAuthorizationsAtom } from "@/atoms/auth/oauth";
import { currentUserAtom } from "@/atoms/auth/session";
import { prefetchQuery, startPrefetchQuery } from "@/atoms/prefetch";
import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";
import { hasPermissions } from "@/components/permission";
import { PermissionDenied } from "@/components/permission-denied";

import { McpAuthorizationsTable } from "../-components/mcp-authorizations-table";
import { McpSetup } from "../-components/mcp-setup";

const mcpAuthorizationReadPermission = ["mcp-authorization:read"] as const;
const mcpAuthorizationRevokePermission = ["mcp-authorization:revoke"] as const;

export const Route = createFileRoute("/_authenticated/settings/workspace/mcp")({
  loader: async ({ abortController, context }) => {
    const currentUser = await prefetchQuery(
      context.atomRegistry,
      currentUserAtom,
      abortController.signal,
    );
    if (currentUser === null) throw redirect({ to: "/auth", replace: true });

    const canRead = hasPermissions(currentUser.role.permissions, mcpAuthorizationReadPermission);
    const canRevoke = hasPermissions(
      currentUser.role.permissions,
      mcpAuthorizationRevokePermission,
    );
    if (canRead) {
      startPrefetchQuery(context.atomRegistry, mcpAuthorizationsAtom, abortController.signal);
    }

    return { canRead, canRevoke };
  },
  component: McpSettingsPage,
});

function McpSettingsPage() {
  const { canRead, canRevoke } = Route.useLoaderData();

  return (
    <DashboardPage>
      <DashboardPage.Header className="md:hidden">
        <DashboardPage.Title />
      </DashboardPage.Header>
      <DashboardPage.Content className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-12 md:py-16">
        <HeadingGroup className="mb-8">
          <HeadingGroup.Title level={1} size="lg">
            MCP
          </HeadingGroup.Title>
          <HeadingGroup.Description>
            Connect AI clients to Namera and manage their delegated account access.
          </HeadingGroup.Description>
        </HeadingGroup>
        {canRead ? (
          <>
            <McpSetup />
            <McpAuthorizationsTable canRevoke={canRevoke} />
          </>
        ) : (
          <PermissionDenied />
        )}
      </DashboardPage.Content>
    </DashboardPage>
  );
}
