import { createFileRoute } from "@tanstack/react-router";

import { prefetchAuthorizedQuery } from "@/atoms/prefetch";
import { membersAtom } from "@/atoms/team";
import { AdminPage } from "@/components/page";
import { readTeamPermission, PermissionGuard } from "@/components/permission";

import { MembersTable } from "./-components/team/members-table";

const denied = <p className="text-muted text-sm">You don’t have access to the admin team.</p>;

export const Route = createFileRoute("/_authenticated/team")({
  loader: async ({ context, abortController }) => {
    await prefetchAuthorizedQuery(
      context.atomRegistry,
      readTeamPermission,
      () => membersAtom,
      abortController.signal,
    );
  },
  component: () => (
    <AdminPage title="Team">
      <PermissionGuard required={readTeamPermission} fallback={denied}>
        <MembersTable />
      </PermissionGuard>
    </AdminPage>
  ),
});
