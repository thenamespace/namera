import { createFileRoute } from "@tanstack/react-router";

import { dashboardOverviewAtom } from "@/atoms/dashboard";
import { startPrefetchQuery } from "@/atoms/prefetch";
import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";

import { Overview } from "./-components/overview";

export const Route = createFileRoute("/_authenticated/")({
  validateSearch: (search): { preview?: boolean } =>
    search.preview === true || search.preview === "true" ? { preview: true } : {},
  loader: ({ abortController, context }) => {
    startPrefetchQuery(context.atomRegistry, dashboardOverviewAtom, abortController.signal);
  },
  component: OverviewPage,
});

function OverviewPage() {
  const { preview = false } = Route.useSearch();

  return (
    <DashboardPage>
      <DashboardPage.Header>
        <DashboardPage.Title>
          <HeadingGroup.Title className="text-sm" level={1} weight="normal">
            Overview
          </HeadingGroup.Title>
        </DashboardPage.Title>
      </DashboardPage.Header>
      <DashboardPage.Content className="w-full px-4 py-6 sm:px-6 lg:py-8">
        <div className="mx-auto max-w-7xl">
          <HeadingGroup className="mb-6">
            <HeadingGroup.Title className="text-xl" level={2}>
              Workspace overview
            </HeadingGroup.Title>
            <HeadingGroup.Description>
              Operational health, usage, and recent activity across your workspace.
            </HeadingGroup.Description>
          </HeadingGroup>
          <Overview preview={preview} />
        </div>
      </DashboardPage.Content>
    </DashboardPage>
  );
}
