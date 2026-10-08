import { createFileRoute } from "@tanstack/react-router";

import { currentAdminAtom } from "@/atoms/auth";
import { invitesAtom } from "@/atoms/invites";
import { prefetchQuery } from "@/atoms/prefetch";
import { AdminPage } from "@/components/page";
import { hasPermissions, readInvitesPermission, PermissionGuard } from "@/components/permission";

import { InvitesTable } from "./-components/invites/invites-table";

const denied = <p className="text-muted text-sm">You do not have access to invite codes.</p>;

export const Route = createFileRoute("/_authenticated/invites")({
  loader: async ({ context, abortController }) => {
    const access = await prefetchQuery(
      context.atomRegistry,
      currentAdminAtom,
      abortController.signal,
    );
    if (
      access.status === "authorized" &&
      hasPermissions(access.admin.permissions, readInvitesPermission)
    ) {
      await prefetchQuery(context.atomRegistry, invitesAtom(), abortController.signal);
    }
  },
  component: () => (
    <AdminPage title="Invites">
      <PermissionGuard required={readInvitesPermission} fallback={denied}>
        <InvitesTable />
      </PermissionGuard>
    </AdminPage>
  ),
});
