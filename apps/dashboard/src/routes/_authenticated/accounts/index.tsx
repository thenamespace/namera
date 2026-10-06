import { Link, createFileRoute, redirect } from "@tanstack/react-router";

import { buttonVariants, cn } from "@namera-ai/ui";
import { Add01Icon, HugeiconsIcon } from "@namera-ai/ui/icons";

import { currentUserAtom } from "@/atoms/auth/session";
import { prefetchQuery, startPrefetchQuery } from "@/atoms/prefetch";
import { walletsAtom } from "@/atoms/wallet";
import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";
import { hasPermissions } from "@/components/permission";

import { AccountsTable } from "./-components/account-table";

const walletCreatePermission = ["wallet:create"] as const;

export const Route = createFileRoute("/_authenticated/accounts/")({
  loader: async ({ abortController, context }) => {
    const currentUser = await prefetchQuery(
      context.atomRegistry,
      currentUserAtom,
      abortController.signal,
    );
    if (currentUser === null) throw redirect({ to: "/auth", replace: true });

    startPrefetchQuery(context.atomRegistry, walletsAtom, abortController.signal);

    return {
      canCreate: hasPermissions(currentUser.role.permissions, walletCreatePermission),
    };
  },
  component: AccountsPage,
});

function AccountsPage() {
  const { canCreate } = Route.useLoaderData();

  return (
    <DashboardPage>
      <DashboardPage.Header>
        <DashboardPage.Title>
          <HeadingGroup.Title level={1} weight="normal" className="text-sm">
            Accounts
          </HeadingGroup.Title>
        </DashboardPage.Title>
        <DashboardPage.Side>
          {canCreate ? (
            <Link
              aria-label="Create account"
              title="Create account"
              className={cn(buttonVariants({ size: "sm", variant: "tertiary", isIconOnly: true }))}
              to="/accounts/new"
            >
              <HugeiconsIcon icon={Add01Icon} />
            </Link>
          ) : null}
        </DashboardPage.Side>
      </DashboardPage.Header>
      <DashboardPage.Content className="w-full px-4 py-6 sm:px-6">
        <AccountsTable />
      </DashboardPage.Content>
    </DashboardPage>
  );
}
