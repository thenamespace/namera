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
  invalidates: QueryKeys.member.lists,
});
export const useRemoveMember = toMutation(removeMemberMutation, {
  invalidates: QueryKeys.member.lists,
});
