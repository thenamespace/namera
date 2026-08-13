import { NameraClient } from "@/atoms/client";
import { QueryKeys } from "@/atoms/query-keys";

export const organizationMembersAtom = NameraClient.query("member", "listOrgMembers", {
  reactivityKeys: [...QueryKeys.organization.active, ...QueryKeys.member.lists],
  timeToLive: "30 seconds",
});

export const organizationRolesAtom = NameraClient.query("member", "listOrgRoles", {
  reactivityKeys: [...QueryKeys.organization.active, ...QueryKeys.role.lists],
  timeToLive: "30 seconds",
});

export const assignableOrganizationRolesAtom = NameraClient.query("member", "listAssignableRoles", {
  reactivityKeys: [...QueryKeys.organization.active, ...QueryKeys.role.assignable],
  timeToLive: "30 seconds",
});

export const updateMemberRoleMutation = NameraClient.mutation("member", "updateMemberRole");
export const removeMemberMutation = NameraClient.mutation("member", "removeMember");
