import { createFileRoute, redirect } from "@tanstack/react-router";

import { organizationAtom } from "@/atoms/auth/organization";
import { currentUserAtom } from "@/atoms/auth/session";
import { prefetchQuery } from "@/atoms/prefetch";
import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";
import { hasPermissions } from "@/components/permission";

import { WorkspaceForm } from "../-components/workspace-form";

const organizationUpdatePermission = ["organization:update"] as const;

export const Route = createFileRoute("/_authenticated/settings/workspace/")({
  loader: async ({ abortController, context }) => {
    const currentUser = await prefetchQuery(
      context.atomRegistry,
      currentUserAtom,
      abortController.signal,
    );
    if (currentUser === null) throw redirect({ to: "/auth", replace: true });
    const organization = await prefetchQuery(
      context.atomRegistry,
      organizationAtom(currentUser.organization.id),
      abortController.signal,
    );
    return {
      canUpdate: hasPermissions(currentUser.role.permissions, organizationUpdatePermission),
      organization,
    };
  },
  component: WorkspacePage,
});

function WorkspacePage() {
  const { canUpdate, organization } = Route.useLoaderData();

  return (
    <DashboardPage>
      <DashboardPage.Header className="md:hidden">
        <DashboardPage.Title />
      </DashboardPage.Header>
      <DashboardPage.Content className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 md:py-16">
        <HeadingGroup className="mb-8">
          <HeadingGroup.Title level={1} size="lg">
            Workspace
          </HeadingGroup.Title>
        </HeadingGroup>
        <WorkspaceForm canUpdate={canUpdate} organization={organization} />
      </DashboardPage.Content>
    </DashboardPage>
  );
}
