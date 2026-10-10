import { createFileRoute, redirect } from "@tanstack/react-router";

import { Schema } from "effect";

import { WalletId } from "@namera-ai/protocol";

import { currentUserAtom } from "@/atoms/auth/session";
import { billingAtom } from "@/atoms/billing";
import { prefetchQuery, startPrefetchQuery } from "@/atoms/prefetch";
import { walletsAtom } from "@/atoms/wallet";
import { DataError } from "@/components/data-error";
import { DataLoading } from "@/components/data-loading";
import { DashboardPage } from "@/components/page";
import { hasPermissions } from "@/components/permission";
import { PermissionDenied } from "@/components/permission-denied";
import { useWallets } from "@/hooks/wallet";

import { CreateSessionKeyForm } from "./-components/create-session-key-form";

const sessionKeyCreatePermission = ["session-key:create"] as const;

export const Route = createFileRoute("/_authenticated/session-keys/new")({
  validateSearch: (search: Record<string, unknown>): { accountId?: WalletId } =>
    Schema.is(WalletId)(search.accountId) ? { accountId: search.accountId } : {},
  loader: async ({ abortController, context }) => {
    const currentUser = await prefetchQuery(
      context.atomRegistry,
      currentUserAtom,
      abortController.signal,
    );
    if (currentUser === null) throw redirect({ to: "/auth", replace: true });

    const canCreate = hasPermissions(currentUser.role.permissions, sessionKeyCreatePermission);
    if (canCreate) startPrefetchQuery(context.atomRegistry, walletsAtom, abortController.signal);
    if (canCreate && hasPermissions(currentUser.role.permissions, ["billing:read"]))
      startPrefetchQuery(context.atomRegistry, billingAtom, abortController.signal);

    return { canCreate };
  },
  component: CreateSessionKeyPage,
});

function CreateSessionKeyPage() {
  const { accountId } = Route.useSearch();
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
            {wallets.data ? (
              <CreateSessionKeyForm wallets={wallets.data} initialAccountId={accountId} />
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
