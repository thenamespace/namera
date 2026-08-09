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
  invalidates: QueryKeys.invitation.lists,
});

export const useAcceptInvitation = toMutation(acceptInvitationMutation, {
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
  invalidates: ({ payload }) => [
    ...QueryKeys.invitation.userLists,
    ...QueryKeys.invitation.detail(payload.invitationId),
  ],
});

export const useCancelInvitation = toMutation(cancelInvitationMutation, {
  invalidates: ({ payload }) => [
    ...QueryKeys.invitation.lists,
    ...QueryKeys.invitation.detail(payload.invitationId),
  ],
});
