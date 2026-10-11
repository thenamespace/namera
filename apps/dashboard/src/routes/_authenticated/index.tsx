import { createFileRoute } from "@tanstack/react-router";

import { dashboardOverviewAtom } from "@/atoms/dashboard";
import { executionsAtom } from "@/atoms/execution";
import { startPrefetchQuery } from "@/atoms/prefetch";
import { sessionKeysAtom } from "@/atoms/session-key";
import { walletsAtom } from "@/atoms/wallet";
import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";

import { AddressPickerPreview, ContractPickerPreview } from "./-components/address-picker-preview";
import { FunctionPickerPreview } from "./-components/function-picker-preview";
import { Overview } from "./-components/overview";

export const Route = createFileRoute("/_authenticated/")({
  loader: ({ abortController, context }) => {
    startPrefetchQuery(context.atomRegistry, dashboardOverviewAtom, abortController.signal);
    startPrefetchQuery(context.atomRegistry, executionsAtom, abortController.signal);
    startPrefetchQuery(context.atomRegistry, walletsAtom, abortController.signal);
    startPrefetchQuery(context.atomRegistry, sessionKeysAtom, abortController.signal);
  },
  component: OverviewPage,
});

function OverviewPage() {
  return (
    <DashboardPage>
      <DashboardPage.Header>
        <DashboardPage.Title>
          <HeadingGroup.Title className="text-sm" level={1} weight="normal">
            Overview
          </HeadingGroup.Title>
        </DashboardPage.Title>
      </DashboardPage.Header>
      <DashboardPage.Content className="w-full px-4 py-6 sm:px-6">
        <AddressPickerPreview />
        <ContractPickerPreview />
        <FunctionPickerPreview />
        <Overview />
      </DashboardPage.Content>
    </DashboardPage>
  );
}
