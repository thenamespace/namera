import { createFileRoute, redirect } from "@tanstack/react-router";

import { currentUserAtom } from "@/atoms/auth/session";
import { billingAtom } from "@/atoms/billing";
import { prefetchQuery, startPrefetchQuery } from "@/atoms/prefetch";
import { DataLoading } from "@/components/data-loading";
import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";
import { hasPermissions } from "@/components/permission";
import { PermissionDenied } from "@/components/permission-denied";
import { useBilling } from "@/hooks/billing";

import { BillingOverview } from "../-components/billing-overview";

const billingReadPermission = ["billing:read"] as const;

export const Route = createFileRoute("/_authenticated/settings/workspace/billings")({
  loader: async ({ abortController, context }) => {
    const currentUser = await prefetchQuery(
      context.atomRegistry,
      currentUserAtom,
      abortController.signal,
    );
    if (currentUser === null) throw redirect({ to: "/auth", replace: true });

    const canRead = hasPermissions(currentUser.role.permissions, billingReadPermission);
    if (canRead) startPrefetchQuery(context.atomRegistry, billingAtom, abortController.signal);

    return { canRead };
  },
  component: BillingPage,
});

function BillingPage() {
  const { canRead } = Route.useLoaderData();
  const billing = useBilling();

  return (
    <DashboardPage>
      <DashboardPage.Header className="md:hidden">
        <DashboardPage.Title />
      </DashboardPage.Header>
      <DashboardPage.Content className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 md:py-16">
        <HeadingGroup className="mb-8">
          <HeadingGroup.Title level={1} size="lg">
            Billing
          </HeadingGroup.Title>
          <HeadingGroup.Description>
            Review what is included with your plan and track your workspace usage.
          </HeadingGroup.Description>
        </HeadingGroup>

        {canRead ? (
          billing.data ? (
            <BillingOverview initialBilling={billing.data} />
          ) : billing.isError ? (
            <PermissionDenied
              description="Billing data could not be loaded. Try refreshing this page."
              title="Couldn't load billing"
            />
          ) : (
            <DataLoading className="min-h-64" label="Loading billing" />
          )
        ) : (
          <PermissionDenied />
        )}
      </DashboardPage.Content>
    </DashboardPage>
  );
}
