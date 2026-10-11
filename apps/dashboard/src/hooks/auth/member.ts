import {
  assignableOrganizationRolesAtom,
  organizationMembersAtom,
  organizationRolesAtom,
  removeMemberMutation,
  updateMemberRoleMutation,
} from "@/atoms/auth/member";
import { QueryKeys } from "@/atoms/query-keys";
import { toMutation, toQuery } from "@/hooks/atom";

export const useOrganizationMembers = toQuery(() => organizationMembersAtom);
export const useOrganizationRoles = toQuery(() => organizationRolesAtom);
export const useAssignableOrganizationRoles = toQuery(() => assignableOrganizationRolesAtom);
export const useUpdateMemberRole = toMutation(updateMemberRoleMutation, {
  analyticsAction: "member_role_update",
  invalidates: QueryKeys.member.lists,
});
export const useRemoveMember = toMutation(removeMemberMutation, {
  analyticsAction: "member_remove",
  invalidates: QueryKeys.member.lists,
});
