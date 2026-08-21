import { createFileRoute, redirect } from "@tanstack/react-router";

import { currentUserAtom } from "@/atoms/auth/session";
import { executionsAtom } from "@/atoms/execution";
import { prefetchQuery, startPrefetchQuery } from "@/atoms/prefetch";
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
  },
  component: ActivityPage,
});

function ActivityPage() {
  return (
    <DashboardPage>
      <DashboardPage.Header className="md:hidden">
        <DashboardPage.Title />
      </DashboardPage.Header>
      <DashboardPage.Content className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 md:py-16">
        <HeadingGroup className="mb-8">
          <HeadingGroup.Title level={1} size="lg">
            Activity
          </HeadingGroup.Title>
          <HeadingGroup.Description>
            Review confirmed transactions across every account and delegated client.
          </HeadingGroup.Description>
        </HeadingGroup>

        <ExecutionsTable />
      </DashboardPage.Content>
    </DashboardPage>
  );
}
