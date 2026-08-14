import { Link, createFileRoute, redirect } from "@tanstack/react-router";

import { buttonVariants, cn } from "@namera-ai/ui";
import { Add01Icon, HugeiconsIcon } from "@namera-ai/ui/icons";

import { currentUserAtom } from "@/atoms/auth/session";
import { prefetchQuery } from "@/atoms/prefetch";
import { walletsAtom } from "@/atoms/wallet";
import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";
import { hasPermissions } from "@/components/permission";

import { AccountsTable } from "./-components/accounts-table";

const walletCreatePermission = ["wallet:create"] as const;

export const Route = createFileRoute("/_authenticated/accounts/")({
  loader: async ({ abortController, context }) => {
    const currentUser = await prefetchQuery(
      context.atomRegistry,
      currentUserAtom,
      abortController.signal,
    );
    if (currentUser === null) throw redirect({ to: "/auth", replace: true });

    const accounts = await prefetchQuery(context.atomRegistry, walletsAtom, abortController.signal);

    return {
      accounts,
      canCreate: hasPermissions(currentUser.role.permissions, walletCreatePermission),
    };
  },
  component: AccountsPage,
});

function AccountsPage() {
  const { accounts, canCreate } = Route.useLoaderData();

  return (
    <DashboardPage>
      <DashboardPage.Header>
        <DashboardPage.Title>
          <HeadingGroup.Title level={1}>Accounts</HeadingGroup.Title>
        </DashboardPage.Title>
        <DashboardPage.Side>
          {canCreate ? (
            <Link
              aria-label="Create account"
              className={cn(buttonVariants({ isIconOnly: true, size: "sm" }))}
              to="/accounts/new"
            >
              <HugeiconsIcon icon={Add01Icon} />
            </Link>
          ) : null}
        </DashboardPage.Side>
      </DashboardPage.Header>
      <DashboardPage.Content className="w-full px-4 py-6 sm:px-6">
        <AccountsTable initialAccounts={accounts} />
      </DashboardPage.Content>
    </DashboardPage>
  );
}
