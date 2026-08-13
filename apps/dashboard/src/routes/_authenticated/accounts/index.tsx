import { Link, createFileRoute, redirect } from "@tanstack/react-router";

import { buttonVariants, cn } from "@namera-ai/ui";
import { Add01Icon, HugeiconsIcon } from "@namera-ai/ui/icons";

import { currentUserAtom } from "@/atoms/auth/session";
import { prefetchQuery } from "@/atoms/prefetch";
import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";
import { hasPermissions } from "@/components/permission";

const walletCreatePermission = ["wallet:create"] as const;

export const Route = createFileRoute("/_authenticated/accounts/")({
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
  component: AccountsPage,
});

function AccountsPage() {
  const { canCreate } = Route.useLoaderData();

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
      <DashboardPage.Content />
    </DashboardPage>
  );
}
