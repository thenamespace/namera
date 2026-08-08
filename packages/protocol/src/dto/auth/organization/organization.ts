import { Schema, Struct } from "effect";

import { OrganizationId } from "#/common/index";
import { Organization, OrganizationInsert } from "#/model/index";

import { GetOrganizationMemberResponse } from "./member.js";

export const GetOrganizationRequest = Schema.Struct({
  id: OrganizationId,
});
export const GetOrganizationResponse = Organization.mapFields(
  Struct.pick(["id", "plan", "metadata"]),
);

export const CreateOrganizationRequest = OrganizationInsert.mapFields(Struct.pick(["metadata"]));
export const CreateOrganizationResponse = GetOrganizationResponse;

export const ListUserOrganizationsResponse = Schema.Array(
  Schema.Struct({
    organization: GetOrganizationResponse,
    organizationMember: GetOrganizationMemberResponse,
  }),
);

export const UpdateOrganizationRequest = Organization.mapFields(Struct.pick(["metadata"]));
export const UpdateOrganizationResponse = GetOrganizationResponse;

export type GetOrganizationRequest = typeof GetOrganizationRequest.Type;
export type GetOrganizationResponse = typeof GetOrganizationResponse.Type;
export type CreateOrganizationRequest = typeof CreateOrganizationRequest.Type;
export type CreateOrganizationResponse = typeof CreateOrganizationResponse.Type;
export type ListUserOrganizationsResponse = typeof ListUserOrganizationsResponse.Type;
export type UpdateOrganizationRequest = typeof UpdateOrganizationRequest.Type;
export type UpdateOrganizationResponse = typeof UpdateOrganizationResponse.Type;
