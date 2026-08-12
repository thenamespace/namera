import { Schema, Struct } from "effect";

import { OrganizationMemberId, OrganizationRoleId } from "#/common/index";
import { OrganizationMember } from "#/model/index";

import { GetUserResponse } from "../core/index.js";
import { GetOrganizationRoleResponse } from "./role.js";

export const GetOrganizationMemberRequest = Schema.Void;
export const GetOrganizationMemberResponse = Schema.Struct({
  organizationMember: OrganizationMember.mapFields(
    Struct.pick(["id", "userId", "organizationId", "organizationRoleId", "joinedAt"]),
  ),
  user: GetUserResponse,
  organizationRole: GetOrganizationRoleResponse,
}).annotate({ identifier: "OrganizationMemberResponse" });

export const ListOrganizationMemberRequest = Schema.Void;
export const ListOrganizationMemberResponse = Schema.Array(GetOrganizationMemberResponse).annotate({
  identifier: "ListOrganizationMembersResponse",
});

export const UpdateOrganizationMemberRoleRequest = Schema.Struct({
  organizationMemberId: OrganizationMemberId,
  organizationRoleId: OrganizationRoleId,
}).annotate({ identifier: "UpdateOrganizationMemberRoleRequest" });
export const UpdateOrganizationMemberRoleResponse = GetOrganizationMemberResponse;

export const RemoveOrganizationMemberRequest = Schema.Struct({
  organizationMemberId: OrganizationMemberId,
}).annotate({ identifier: "RemoveOrganizationMemberRequest" });
export const RemoveOrganizationMemberResponse = Schema.Void;

export type GetOrganizationMemberRequest = typeof GetOrganizationMemberRequest.Type;
export type GetOrganizationMemberResponse = typeof GetOrganizationMemberResponse.Type;
export type ListOrganizationMemberRequest = typeof ListOrganizationMemberRequest.Type;
export type ListOrganizationMemberResponse = typeof ListOrganizationMemberResponse.Type;
export type UpdateOrganizationMemberRoleRequest = typeof UpdateOrganizationMemberRoleRequest.Type;
export type UpdateOrganizationMemberRoleResponse = typeof UpdateOrganizationMemberRoleResponse.Type;
export type RemoveOrganizationMemberRequest = typeof RemoveOrganizationMemberRequest.Type;
export type RemoveOrganizationMemberResponse = typeof RemoveOrganizationMemberResponse.Type;
