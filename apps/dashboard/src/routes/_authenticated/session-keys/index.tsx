import { Link, createFileRoute, redirect } from "@tanstack/react-router";

import { buttonVariants, cn } from "@namera-ai/ui";
import { Add01Icon, HugeiconsIcon } from "@namera-ai/ui/icons";

import { currentUserAtom } from "@/atoms/auth/session";
import { prefetchQuery, startPrefetchQuery } from "@/atoms/prefetch";
import { sessionKeysAtom } from "@/atoms/session-key";
import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";
import { hasPermissions } from "@/components/permission";
import { SessionKeysTable } from "@/components/session-keys-table";

const sessionKeyCreatePermission = ["session-key:create"] as const;

export const Route = createFileRoute("/_authenticated/session-keys/")({
  loader: async ({ abortController, context }) => {
    const currentUser = await prefetchQuery(
      context.atomRegistry,
      currentUserAtom,
      abortController.signal,
    );
    if (currentUser === null) throw redirect({ to: "/auth", replace: true });

    startPrefetchQuery(context.atomRegistry, sessionKeysAtom, abortController.signal);

    return {
      canCreate: hasPermissions(currentUser.role.permissions, sessionKeyCreatePermission),
    };
  },
  component: SessionKeysPage,
});

function SessionKeysPage() {
  const { canCreate } = Route.useLoaderData();

  return (
    <DashboardPage>
      <DashboardPage.Header>
        <DashboardPage.Title>
          <HeadingGroup.Title level={1} weight="normal" className="text-sm">
            Session Keys
          </HeadingGroup.Title>
        </DashboardPage.Title>
        <DashboardPage.Side>
          {canCreate ? (
            <Link
              aria-label="Create session key"
              title="Create session key"
              className={cn(buttonVariants({ size: "sm", variant: "tertiary", isIconOnly: true }))}
              to="/session-keys/new"
            >
              <HugeiconsIcon icon={Add01Icon} />
            </Link>
          ) : null}
        </DashboardPage.Side>
      </DashboardPage.Header>
      <DashboardPage.Content className="w-full px-4 py-6 sm:px-6">
        <SessionKeysTable />
      </DashboardPage.Content>
    </DashboardPage>
  );
}
