import { createFileRoute } from "@tanstack/react-router";

import { overviewAtom } from "@/atoms/overview";
import { prefetchAuthorizedQuery } from "@/atoms/prefetch";
import { AdminPage } from "@/components/page";
import { PermissionGuard, readOverviewPermission } from "@/components/permission";

import { Overview } from "./-components/overview";

const denied = <p className="text-muted text-sm">You do not have access to the overview.</p>;

export const Route = createFileRoute("/_authenticated/")({
  loader: async ({ context, abortController }) => {
    await prefetchAuthorizedQuery(
      context.atomRegistry,
      readOverviewPermission,
      () => overviewAtom(),
      abortController.signal,
    );
  },
  component: () => (
    <AdminPage title="Overview">
      <PermissionGuard required={readOverviewPermission} fallback={denied}>
        <Overview />
      </PermissionGuard>
    </AdminPage>
  ),
});
