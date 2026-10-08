import { QueryKeys } from "@/atoms/query-keys";
import {
  membersAtom,
  inviteMemberMutation,
  changeRoleMutation,
  removeMemberMutation,
  acceptTeamInvitationMutation,
} from "@/atoms/team";
import { toMutation, toQuery } from "@/hooks/atom";

export const useMembers = toQuery(() => membersAtom);
export const useInviteMember = toMutation(inviteMemberMutation);
export const useAcceptTeamInvitation = toMutation(acceptTeamInvitationMutation);
export const useChangeMemberRole = toMutation(changeRoleMutation, {
  invalidates: QueryKeys.team.members,
});
export const useRemoveMember = toMutation(removeMemberMutation, {
  invalidates: QueryKeys.team.members,
});
