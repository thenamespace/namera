import { Schema, Struct } from "effect";

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

export type GetOrganizationMemberRequest = typeof GetOrganizationMemberRequest.Type;
export type GetOrganizationMemberResponse = typeof GetOrganizationMemberResponse.Type;
export type ListOrganizationMemberRequest = typeof ListOrganizationMemberRequest.Type;
export type ListOrganizationMemberResponse = typeof ListOrganizationMemberResponse.Type;
