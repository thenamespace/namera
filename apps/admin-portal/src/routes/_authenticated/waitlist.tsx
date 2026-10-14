import { createFileRoute } from "@tanstack/react-router";

import { prefetchAuthorizedQuery } from "@/atoms/prefetch";
import { waitlistAtom } from "@/atoms/waitlist";
import { AdminPage } from "@/components/page";
import { PermissionGuard, readWaitlistPermission } from "@/components/permission";

import { WaitlistTable } from "./-components/waitlist/waitlist-table";

const denied = <p className="text-muted text-sm">You do not have access to the waitlist.</p>;

export const Route = createFileRoute("/_authenticated/waitlist")({
  loader: async ({ context, abortController }) => {
    await prefetchAuthorizedQuery(
      context.atomRegistry,
      readWaitlistPermission,
      () => waitlistAtom(),
      abortController.signal,
    );
  },
  component: () => (
    <AdminPage title="Waitlist">
      <PermissionGuard required={readWaitlistPermission} fallback={denied}>
        <WaitlistTable />
      </PermissionGuard>
    </AdminPage>
  ),
});
