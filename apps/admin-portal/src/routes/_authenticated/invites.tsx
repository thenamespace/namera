import { createFileRoute } from "@tanstack/react-router";

import { invitesAtom } from "@/atoms/invites";
import { prefetchAuthorizedQuery } from "@/atoms/prefetch";
import { AdminPage } from "@/components/page";
import { readInvitesPermission, PermissionGuard } from "@/components/permission";

import { InvitesTable } from "./-components/invites/invites-table";

const denied = <p className="text-muted text-sm">You do not have access to invite codes.</p>;

export const Route = createFileRoute("/_authenticated/invites")({
  loader: async ({ context, abortController }) => {
    await prefetchAuthorizedQuery(
      context.atomRegistry,
      readInvitesPermission,
      () => invitesAtom(),
      abortController.signal,
    );
  },
  component: () => (
    <AdminPage title="Invites">
      <PermissionGuard required={readInvitesPermission} fallback={denied}>
        <InvitesTable />
      </PermissionGuard>
    </AdminPage>
  ),
});
