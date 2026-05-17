import { Schema } from "effect";

import { OrganizationMember, OrganizationMemberRole } from "@/auth";
import { OrganizationId, OrganizationMemberId } from "@/common";

export const ListOrganizationMembersRequest = Schema.Struct({
  // TODO: Add filters here
  organizationId: OrganizationId,
});

export const ListOrganizationMembersResponse = Schema.Array(OrganizationMember);

export const RemoveOrganizationMemberRequest = Schema.Struct({
  organizationId: OrganizationId,
  memberId: OrganizationMemberId,
});
export const RemoveOrganizationMemberResponse = Schema.Void;

export const UpdateOrganizationMemberRoleRequest = Schema.Struct({
  role: OrganizationMemberRole,
  memberId: OrganizationMemberId,
  organizationId: OrganizationId,
});

export const UpdateOrganizationMemberRoleResponse = Schema.Void;

export const GetOrganizationMemberRequest = Schema.Struct({
  organizationId: OrganizationId,
  memberId: OrganizationMemberId,
});

export const GetOrganizationMemberResponse = OrganizationMember;

export const LeaveOrganizationRequest = Schema.Struct({
  organizationId: OrganizationId,
});

export const LeaveOrganizationResponse = Schema.Void;

export type ListOrganizationMembersRequest =
  typeof ListOrganizationMembersRequest.Type;
export type ListOrganizationMembersResponse =
  typeof ListOrganizationMembersResponse.Type;
export type RemoveOrganizationMemberRequest =
  typeof RemoveOrganizationMemberRequest.Type;
export type RemoveOrganizationMemberResponse =
  typeof RemoveOrganizationMemberResponse.Type;
export type UpdateOrganizationMemberRoleRequest =
  typeof UpdateOrganizationMemberRoleRequest.Type;
export type UpdateOrganizationMemberRoleResponse =
  typeof UpdateOrganizationMemberRoleResponse.Type;
export type GetOrganizationMemberRequest =
  typeof GetOrganizationMemberRequest.Type;
export type GetOrganizationMemberResponse =
  typeof GetOrganizationMemberResponse.Type;
export type LeaveOrganizationRequest = typeof LeaveOrganizationRequest.Type;
export type LeaveOrganizationResponse = typeof LeaveOrganizationResponse.Type;
