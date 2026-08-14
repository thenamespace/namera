import { createFileRoute, redirect } from "@tanstack/react-router";

import { currentUserAtom } from "@/atoms/auth/session";
import { prefetchQuery } from "@/atoms/prefetch";
import { walletsAtom } from "@/atoms/wallet";
import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";
import { hasPermissions } from "@/components/permission";
import { PermissionDenied } from "@/components/permission-denied";

import { CreateSessionKeyForm } from "./-components/create-session-key-form";

const sessionKeyCreatePermission = ["session-key:create"] as const;

export const Route = createFileRoute("/_authenticated/session-keys/new")({
  loader: async ({ abortController, context }) => {
    const currentUser = await prefetchQuery(
      context.atomRegistry,
      currentUserAtom,
      abortController.signal,
    );
    if (currentUser === null) throw redirect({ to: "/auth", replace: true });

    const canCreate = hasPermissions(currentUser.role.permissions, sessionKeyCreatePermission);
    const wallets = canCreate
      ? await prefetchQuery(context.atomRegistry, walletsAtom, abortController.signal)
      : [];

    return { canCreate, wallets };
  },
  component: CreateSessionKeyPage,
});

function CreateSessionKeyPage() {
  const { canCreate, wallets } = Route.useLoaderData();

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
                Create a session key
              </HeadingGroup.Title>
              <HeadingGroup.Description>
                Define scoped access to an account for agents and integrations.
              </HeadingGroup.Description>
            </HeadingGroup>
            <CreateSessionKeyForm wallets={wallets} />
          </>
        ) : (
          <PermissionDenied />
        )}
      </DashboardPage.Content>
    </DashboardPage>
  );
}
