import { createFileRoute } from "@tanstack/react-router";

import { currentAdminAtom } from "@/atoms/auth";
import { prefetchQuery } from "@/atoms/prefetch";
import { waitlistAtom } from "@/atoms/waitlist";
import { AdminPage } from "@/components/page";
import { hasPermissions, PermissionGuard, readWaitlistPermission } from "@/components/permission";

import { WaitlistTable } from "./-components/waitlist/waitlist-table";

const denied = <p className="text-muted text-sm">You do not have access to the waitlist.</p>;

export const Route = createFileRoute("/_authenticated/waitlist")({
  loader: async ({ context, abortController }) => {
    const access = await prefetchQuery(
      context.atomRegistry,
      currentAdminAtom,
      abortController.signal,
    );
    if (
      access.status === "authorized" &&
      hasPermissions(access.admin.permissions, readWaitlistPermission)
    ) {
      await prefetchQuery(context.atomRegistry, waitlistAtom(), abortController.signal);
    }
  },
  component: () => (
    <AdminPage title="Waitlist">
      <PermissionGuard required={readWaitlistPermission} fallback={denied}>
        <WaitlistTable />
      </PermissionGuard>
    </AdminPage>
  ),
});
