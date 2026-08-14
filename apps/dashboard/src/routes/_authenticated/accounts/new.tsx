import { createFileRoute, redirect } from "@tanstack/react-router";

import { currentUserAtom } from "@/atoms/auth/session";
import { prefetchQuery } from "@/atoms/prefetch";
import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";
import { hasPermissions } from "@/components/permission";
import { PermissionDenied } from "@/components/permission-denied";

import { CreateAccountForm } from "./-components/create-account-form";

const walletCreatePermission = ["wallet:create"] as const;

export const Route = createFileRoute("/_authenticated/accounts/new")({
  loader: async ({ abortController, context }) => {
    const currentUser = await prefetchQuery(
      context.atomRegistry,
      currentUserAtom,
      abortController.signal,
    );
    if (currentUser === null) throw redirect({ to: "/auth", replace: true });

    return {
      canCreate: hasPermissions(currentUser.role.permissions, walletCreatePermission),
    };
  },
  component: CreateAccountPage,
});

function CreateAccountPage() {
  const { canCreate } = Route.useLoaderData();

  return (
    <DashboardPage>
      <DashboardPage.Header className="md:hidden">
        <DashboardPage.Title />
      </DashboardPage.Header>
      <DashboardPage.Content className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 md:py-16">
        {canCreate ? (
          <>
            <HeadingGroup className="mb-6">
              <HeadingGroup.Title level={1} size="md">
                Create an account
              </HeadingGroup.Title>
              <HeadingGroup.Description>
                Create a programmable smart account for this workspace.
              </HeadingGroup.Description>
            </HeadingGroup>
            <CreateAccountForm />
          </>
        ) : (
          <PermissionDenied />
        )}
      </DashboardPage.Content>
    </DashboardPage>
  );
}
