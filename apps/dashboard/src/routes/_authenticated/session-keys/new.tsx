import { createFileRoute, redirect } from "@tanstack/react-router";

import { currentUserAtom } from "@/atoms/auth/session";
import { prefetchQuery, startPrefetchQuery } from "@/atoms/prefetch";
import { walletsAtom } from "@/atoms/wallet";
import { DataError } from "@/components/data-error";
import { DataLoading } from "@/components/data-loading";
import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";
import { hasPermissions } from "@/components/permission";
import { PermissionDenied } from "@/components/permission-denied";
import { useWallets } from "@/hooks/wallet";

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
    if (canCreate) startPrefetchQuery(context.atomRegistry, walletsAtom, abortController.signal);

    return { canCreate };
  },
  component: CreateSessionKeyPage,
});

function CreateSessionKeyPage() {
  const { canCreate } = Route.useLoaderData();
  const wallets = useWallets();

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
            {wallets.data ? (
              <CreateSessionKeyForm wallets={wallets.data} />
            ) : wallets.isError ? (
              <DataError
                label="accounts"
                onRetry={wallets.refetch}
                isRetrying={wallets.isFetching}
              />
            ) : (
              <DataLoading className="min-h-64" label="Loading accounts" />
            )}
          </>
        ) : (
          <PermissionDenied />
        )}
      </DashboardPage.Content>
    </DashboardPage>
  );
}
