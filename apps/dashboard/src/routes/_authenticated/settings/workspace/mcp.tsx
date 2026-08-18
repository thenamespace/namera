import { createFileRoute, redirect } from "@tanstack/react-router";

import { mcpAuthorizationsAtom } from "@/atoms/auth/oauth";
import { currentUserAtom } from "@/atoms/auth/session";
import { prefetchQuery } from "@/atoms/prefetch";
import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";
import { hasPermissions } from "@/components/permission";
import { PermissionDenied } from "@/components/permission-denied";

import { McpAuthorizationsTable } from "../-components/mcp-authorizations-table";
import { McpInstallation } from "../-components/mcp-installation";

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
    const authorizations = canRead
      ? await prefetchQuery(context.atomRegistry, mcpAuthorizationsAtom, abortController.signal)
      : [];

    return { authorizations, canRead, canRevoke };
  },
  component: McpSettingsPage,
});

function McpSettingsPage() {
  const { authorizations, canRead, canRevoke } = Route.useLoaderData();

  return (
    <DashboardPage>
      <DashboardPage.Header className="md:hidden">
        <DashboardPage.Title />
      </DashboardPage.Header>
      <DashboardPage.Content className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 md:py-16">
        <HeadingGroup className="mb-8">
          <HeadingGroup.Title level={1} size="lg">
            MCP
          </HeadingGroup.Title>
          <HeadingGroup.Description>
            Connect AI clients to Namera and manage their delegated account access.
          </HeadingGroup.Description>
        </HeadingGroup>

        <section aria-labelledby="mcp-installation-heading">
          <McpInstallation />
        </section>

        <section className="mt-12" aria-labelledby="mcp-authorizations-heading">
          <HeadingGroup className="mb-4">
            <HeadingGroup.Title id="mcp-authorizations-heading">Authorizations</HeadingGroup.Title>
            <HeadingGroup.Description>
              Clients that have been granted access to this workspace.
            </HeadingGroup.Description>
          </HeadingGroup>
          {canRead ? (
            <McpAuthorizationsTable canRevoke={canRevoke} initialAuthorizations={authorizations} />
          ) : (
            <PermissionDenied />
          )}
        </section>
      </DashboardPage.Content>
    </DashboardPage>
  );
}
