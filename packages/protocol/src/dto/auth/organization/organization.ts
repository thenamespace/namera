import { Schema, Struct } from "effect";

import { OrganizationId } from "#/common/index";
import { Organization, OrganizationInsert, OrganizationUpdate } from "#/model/index";

import { GetOrganizationMemberResponse } from "./member.js";

export const GetOrganizationRequest = Schema.Struct({
  organizationId: OrganizationId,
}).annotate({ identifier: "GetOrganizationRequest" });
export const GetOrganizationResponse = Organization.mapFields(
  Struct.pick(["id", "metadata"]),
).annotate({ identifier: "OrganizationResponse", description: "Organization details" });

export const CreateOrganizationRequest = OrganizationInsert.mapFields(
  Struct.pick(["metadata"]),
).annotate({ identifier: "CreateOrganizationRequest" });
export const CreateOrganizationResponse = GetOrganizationResponse;

export const ListUserOrganizationsResponse = Schema.Array(
  Schema.Struct({
    organization: GetOrganizationResponse,
    organizationMember: GetOrganizationMemberResponse,
  }),
).annotate({ identifier: "ListUserOrganizationsResponse" });

export const UpdateOrganizationRequest = OrganizationUpdate.annotate({
  identifier: "UpdateOrganizationRequest",
});
export const UpdateOrganizationResponse = GetOrganizationResponse;

export type GetOrganizationRequest = typeof GetOrganizationRequest.Type;
export type GetOrganizationResponse = typeof GetOrganizationResponse.Type;
export type CreateOrganizationRequest = typeof CreateOrganizationRequest.Type;
export type CreateOrganizationResponse = typeof CreateOrganizationResponse.Type;
export type ListUserOrganizationsResponse = typeof ListUserOrganizationsResponse.Type;
export type UpdateOrganizationRequest = typeof UpdateOrganizationRequest.Type;
export type UpdateOrganizationResponse = typeof UpdateOrganizationResponse.Type;
