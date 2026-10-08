import { createFileRoute } from "@tanstack/react-router";

import { currentAdminAtom } from "@/atoms/auth";
import { prefetchQuery } from "@/atoms/prefetch";
import { membersAtom } from "@/atoms/team";
import { AdminPage } from "@/components/page";
import { hasPermissions, manageTeamPermission, PermissionGuard } from "@/components/permission";

import { MembersTable } from "./-components/team/members-table";

const denied = <p className="text-muted text-sm">Only the owner can manage the admin team.</p>;

export const Route = createFileRoute("/_authenticated/team")({
  loader: async ({ context, abortController }) => {
    const access = await prefetchQuery(
      context.atomRegistry,
      currentAdminAtom,
      abortController.signal,
    );
    if (
      access.status === "authorized" &&
      hasPermissions(access.admin.permissions, manageTeamPermission)
    ) {
      await prefetchQuery(context.atomRegistry, membersAtom, abortController.signal);
    }
  },
  component: () => (
    <AdminPage title="Team">
      <PermissionGuard required={manageTeamPermission} fallback={denied}>
        <MembersTable />
      </PermissionGuard>
    </AdminPage>
  ),
});
