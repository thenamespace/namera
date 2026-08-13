import { createFileRoute, redirect } from "@tanstack/react-router";

import { organizationInvitationsAtom } from "@/atoms/auth/invitation";
import { assignableOrganizationRolesAtom, organizationMembersAtom } from "@/atoms/auth/member";
import { currentUserAtom } from "@/atoms/auth/session";
import { prefetchQuery } from "@/atoms/prefetch";
import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";
import { hasPermissions } from "@/components/permission";

import { InvitationsTable } from "../-components/invitations-table";
import { MembersTable } from "../-components/members-table";

const invitationCancelPermission = ["invitation:cancel"] as const;
const invitationReadPermission = ["invitation:read"] as const;
const memberManagePermissions = ["member:update", "member:remove"] as const;
const roleReadPermission = ["role:read"] as const;

export const Route = createFileRoute("/_authenticated/settings/workspace/members")({
  loader: async ({ abortController, context }) => {
    const currentUser = await prefetchQuery(
      context.atomRegistry,
      currentUserAtom,
      abortController.signal,
    );
    if (currentUser === null) throw redirect({ to: "/auth", replace: true });

    const canReadInvitations = hasPermissions(
      currentUser.role.permissions,
      invitationReadPermission,
    );
    const canReadRoles = hasPermissions(currentUser.role.permissions, roleReadPermission);
    const canManageMembers = memberManagePermissions.some((permission) =>
      currentUser.role.permissions.includes(permission),
    );
    const [members, assignableRoles, invitations] = await Promise.all([
      prefetchQuery(context.atomRegistry, organizationMembersAtom, abortController.signal),
      canReadRoles
        ? prefetchQuery(
            context.atomRegistry,
            assignableOrganizationRolesAtom,
            abortController.signal,
          )
        : Promise.resolve([]),
      canReadInvitations
        ? prefetchQuery(context.atomRegistry, organizationInvitationsAtom, abortController.signal)
        : Promise.resolve([]),
    ]);
    return {
      currentUser,
      members,
      assignableRoles,
      invitations,
      canReadInvitations,
      canReadRoles,
      canManageMembers,
    };
  },
  component: MembersPage,
});

function MembersPage() {
  const {
    assignableRoles,
    canManageMembers,
    canReadInvitations,
    canReadRoles,
    currentUser,
    invitations,
    members,
  } = Route.useLoaderData();

  return (
    <DashboardPage>
      <DashboardPage.Header className="md:hidden">
        <DashboardPage.Title />
      </DashboardPage.Header>
      <DashboardPage.Content className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 md:py-16">
        <HeadingGroup className="mb-8">
          <HeadingGroup.Title level={1} size="lg">
            Members
          </HeadingGroup.Title>
        </HeadingGroup>
        <MembersTable
          canManageMembers={canManageMembers}
          canReadRoles={canReadRoles}
          initialMembers={members}
          initialRoles={assignableRoles}
        />
        {canReadInvitations ? (
          <>
            <HeadingGroup className="mb-4 mt-12">
              <HeadingGroup.Title>Pending invitations</HeadingGroup.Title>
              <HeadingGroup.Description>
                Invitations that have not yet been accepted or cancelled.
              </HeadingGroup.Description>
            </HeadingGroup>
            <InvitationsTable
              canCancel={hasPermissions(currentUser.role.permissions, invitationCancelPermission)}
              initialInvitations={invitations}
            />
          </>
        ) : null}
      </DashboardPage.Content>
    </DashboardPage>
  );
}
