import { createFileRoute } from "@tanstack/react-router";

import { currentAdminAtom } from "@/atoms/auth";
import { overviewAtom } from "@/atoms/overview";
import { prefetchQuery } from "@/atoms/prefetch";
import { AdminPage } from "@/components/page";
import { hasPermissions, PermissionGuard, readOverviewPermission } from "@/components/permission";

import { Overview } from "./-components/overview";

const denied = <p className="text-muted text-sm">You do not have access to the overview.</p>;

export const Route = createFileRoute("/_authenticated/")({
  loader: async ({ context, abortController }) => {
    const access = await prefetchQuery(
      context.atomRegistry,
      currentAdminAtom,
      abortController.signal,
    );
    if (
      access.status === "authorized" &&
      hasPermissions(access.admin.permissions, readOverviewPermission)
    ) {
      await prefetchQuery(context.atomRegistry, overviewAtom(), abortController.signal);
    }
  },
  component: () => (
    <AdminPage title="Overview">
      <PermissionGuard required={readOverviewPermission} fallback={denied}>
        <Overview />
      </PermissionGuard>
    </AdminPage>
  ),
});
