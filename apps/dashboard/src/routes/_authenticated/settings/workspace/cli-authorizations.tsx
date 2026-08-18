import { createFileRoute, redirect } from "@tanstack/react-router";

import { cliAuthorizationsAtom } from "@/atoms/auth/oauth";
import { currentUserAtom } from "@/atoms/auth/session";
import { prefetchQuery } from "@/atoms/prefetch";
import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";
import { hasPermissions } from "@/components/permission";
import { PermissionDenied } from "@/components/permission-denied";

import { CliAuthorizationsTable } from "../-components/cli-authorizations-table";

const cliAuthorizationReadPermission = ["cli-authorization:read"] as const;
const cliAuthorizationRevokePermission = ["cli-authorization:revoke"] as const;

export const Route = createFileRoute("/_authenticated/settings/workspace/cli-authorizations")({
  loader: async ({ abortController, context }) => {
    const currentUser = await prefetchQuery(
      context.atomRegistry,
      currentUserAtom,
      abortController.signal,
    );
    if (currentUser === null) throw redirect({ to: "/auth", replace: true });

    const canRead = hasPermissions(currentUser.role.permissions, cliAuthorizationReadPermission);
    const canRevoke = hasPermissions(
      currentUser.role.permissions,
      cliAuthorizationRevokePermission,
    );
    const authorizations = canRead
      ? await prefetchQuery(context.atomRegistry, cliAuthorizationsAtom, abortController.signal)
      : [];

    return { authorizations, canRead, canRevoke };
  },
  component: CliAuthorizationsPage,
});

function CliAuthorizationsPage() {
  const { authorizations, canRead, canRevoke } = Route.useLoaderData();

  return (
    <DashboardPage>
      <DashboardPage.Header className="md:hidden">
        <DashboardPage.Title />
      </DashboardPage.Header>
      <DashboardPage.Content className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 md:py-16">
        <HeadingGroup className="mb-8">
          <HeadingGroup.Title level={1} size="lg">
            CLI authorizations
          </HeadingGroup.Title>
          <HeadingGroup.Description>
            Review and revoke terminal sessions connected to this workspace.
          </HeadingGroup.Description>
        </HeadingGroup>
        {canRead ? (
          <CliAuthorizationsTable canRevoke={canRevoke} initialAuthorizations={authorizations} />
        ) : (
          <PermissionDenied />
        )}
      </DashboardPage.Content>
    </DashboardPage>
  );
}
