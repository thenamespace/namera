import { createFileRoute } from "@tanstack/react-router";

import { dashboardOverviewAtom } from "@/atoms/dashboard";
import { executionsAtom } from "@/atoms/execution";
import { startPrefetchQuery } from "@/atoms/prefetch";
import { sessionKeysAtom } from "@/atoms/session-key";
import { walletsAtom } from "@/atoms/wallet";
import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";

import { Overview } from "./-components/overview";

export const Route = createFileRoute("/_authenticated/")({
  validateSearch: (search): { preview?: boolean } =>
    search.preview === true || search.preview === "true" ? { preview: true } : {},
  loader: ({ abortController, context }) => {
    startPrefetchQuery(context.atomRegistry, dashboardOverviewAtom, abortController.signal);
    startPrefetchQuery(context.atomRegistry, executionsAtom, abortController.signal);
    startPrefetchQuery(context.atomRegistry, walletsAtom, abortController.signal);
    startPrefetchQuery(context.atomRegistry, sessionKeysAtom, abortController.signal);
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
      <DashboardPage.Content className="w-full px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <Overview preview={preview} />
        </div>
      </DashboardPage.Content>
    </DashboardPage>
  );
}
