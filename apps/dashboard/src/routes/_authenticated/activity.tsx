import { createFileRoute, redirect } from "@tanstack/react-router";

import { currentUserAtom } from "@/atoms/auth/session";
import { executionsAtom } from "@/atoms/execution";
import { prefetchQuery, startPrefetchQuery } from "@/atoms/prefetch";
import { sessionKeysAtom } from "@/atoms/session-key";
import { walletsAtom } from "@/atoms/wallet";
import { ExecutionsTable } from "@/components/executions-table";
import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";

export const Route = createFileRoute("/_authenticated/activity")({
  loader: async ({ abortController, context }) => {
    const currentUser = await prefetchQuery(
      context.atomRegistry,
      currentUserAtom,
      abortController.signal,
    );
    if (currentUser === null) throw redirect({ to: "/auth", replace: true });

    startPrefetchQuery(context.atomRegistry, executionsAtom, abortController.signal);
    startPrefetchQuery(context.atomRegistry, walletsAtom, abortController.signal);
    startPrefetchQuery(context.atomRegistry, sessionKeysAtom, abortController.signal);
  },
  component: ActivityPage,
});

function ActivityPage() {
  return (
    <DashboardPage>
      <DashboardPage.Header>
        <DashboardPage.Title>
          <HeadingGroup.Title className="text-sm" level={1} weight="normal">
            Activity
          </HeadingGroup.Title>
        </DashboardPage.Title>
      </DashboardPage.Header>
      <DashboardPage.Content className="w-full px-4 py-6 sm:px-6">
        <ExecutionsTable />
      </DashboardPage.Content>
    </DashboardPage>
  );
}
