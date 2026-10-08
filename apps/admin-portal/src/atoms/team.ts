import { NameraClient } from "@/atoms/client";
import { QueryKeys } from "@/atoms/query-keys";

export const membersAtom = NameraClient.query("platform", "members", {
  reactivityKeys: QueryKeys.team.members,
  timeToLive: "30 seconds",
});
export const inviteMemberMutation = NameraClient.mutation("platform", "invite");
export const changeRoleMutation = NameraClient.mutation("platform", "changeRole");
export const removeMemberMutation = NameraClient.mutation("platform", "removeMember");
export const acceptTeamInvitationMutation = NameraClient.mutation("platformInvitation", "accept");
