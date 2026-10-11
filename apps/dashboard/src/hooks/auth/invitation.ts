import {
  acceptInvitationMutation,
  cancelInvitationMutation,
  invitationAtom,
  inviteMemberMutation,
  organizationInvitationsAtom,
  rejectInvitationMutation,
  userInvitationsAtom,
} from "@/atoms/auth/invitation";
import { QueryKeys } from "@/atoms/query-keys";
import { toMutation, toQuery } from "@/hooks/atom";

export const useInvitation = toQuery(invitationAtom);
export const useOrganizationInvitations = toQuery(() => organizationInvitationsAtom);
export const useUserInvitations = toQuery(() => userInvitationsAtom);

export const useInviteMember = toMutation(inviteMemberMutation, {
  analyticsAction: "member_invite",
  invalidates: QueryKeys.invitation.lists,
});

export const useAcceptInvitation = toMutation(acceptInvitationMutation, {
  analyticsAction: "invitation_accept",
  invalidates: ({ payload }) => [
    ...QueryKeys.session.current,
    ...QueryKeys.session.lists,
    ...QueryKeys.organization.active,
    ...QueryKeys.organization.lists,
    ...QueryKeys.member.lists,
    ...QueryKeys.invitation.userLists,
    ...QueryKeys.invitation.detail(payload.invitationId),
  ],
});

export const useRejectInvitation = toMutation(rejectInvitationMutation, {
  analyticsAction: "invitation_reject",
  invalidates: ({ payload }) => [
    ...QueryKeys.invitation.userLists,
    ...QueryKeys.invitation.detail(payload.invitationId),
  ],
});

export const useCancelInvitation = toMutation(cancelInvitationMutation, {
  analyticsAction: "invitation_cancel",
  invalidates: ({ payload }) => [
    ...QueryKeys.invitation.lists,
    ...QueryKeys.invitation.detail(payload.invitationId),
  ],
});
