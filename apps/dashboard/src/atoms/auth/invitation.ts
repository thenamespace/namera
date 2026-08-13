import type { InvitationId } from "@namera-ai/protocol";

import { NameraClient } from "@/atoms/client";
import { QueryKeys } from "@/atoms/query-keys";

export const invitationAtom = (invitationId: InvitationId) =>
  NameraClient.query("invitation", "getInvitation", {
    query: { invitationId },
    reactivityKeys: [
      ...QueryKeys.invitation.all,
      ...QueryKeys.invitation.details,
      ...QueryKeys.invitation.detail(invitationId),
    ],
    timeToLive: "30 seconds",
  });

export const organizationInvitationsAtom = NameraClient.query("invitation", "listInvitations", {
  reactivityKeys: [
    ...QueryKeys.organization.active,
    ...QueryKeys.invitation.all,
    ...QueryKeys.invitation.lists,
  ],
  timeToLive: "30 seconds",
});

export const userInvitationsAtom = NameraClient.query("invitation", "listUserInvitations", {
  reactivityKeys: [...QueryKeys.invitation.all, ...QueryKeys.invitation.userLists],
  timeToLive: "30 seconds",
});

export const inviteMemberMutation = NameraClient.mutation("invitation", "inviteMember");
export const acceptInvitationMutation = NameraClient.mutation("invitation", "acceptInvitation");
export const rejectInvitationMutation = NameraClient.mutation("invitation", "rejectInvitation");
export const cancelInvitationMutation = NameraClient.mutation("invitation", "cancelInvitation");
