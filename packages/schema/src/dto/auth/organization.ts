import { Schema, Struct } from "effect";

import { OrganizationId } from "../../common";
import {
  Organization,
  OrganizationInsert,
  OrganizationMember,
} from "../../database";
import { OrganizationRole } from "../../database/auth/role";

export class OrganizationError extends Schema.TaggedErrorClass<OrganizationError>()(
  "OrganizationError",
  {
    code: Schema.Literals([
      "ORGANIZATION_CREATE_FAILED",
      "ORGANIZATION_UPDATE_FAILED",
      "INSUFFICIENT_PERMISSIONS",
      "SLUG_ALREADY_TAKEN",
      "ORGANIZATION_CREATION_LIMIT_REACHED",
      "ORGANIZATION_NOT_FOUND",
      "ORGANIZATION_MEMBER_NOT_FOUND",
    ]),
    message: Schema.optional(Schema.String),
  },
) {}

export const GetOrganizationRequest = Schema.Struct({
  id: OrganizationId,
});
export const GetOrganizationResponse = Organization.mapFields(
  Struct.pick(["id", "name", "plan", "metadata"]),
);

export const CreateOrganizationRequest = OrganizationInsert.mapFields(
  Struct.pick(["name", "metadata"]),
);
export const CreateOrganizationResponse = GetOrganizationResponse;

export const ListUserOrganizationsResponse = Schema.mutable(
  Schema.Array(
    Schema.Struct({
      organization: GetOrganizationResponse,
      member: OrganizationMember, // TODO: Update
      role: OrganizationRole, // TODO: Update
    }),
  ),
);

export const SetActiveOrganizationRequest = Schema.Struct({
  id: OrganizationId,
});
export const SetActiveOrganizationResponse = Schema.Void;

// Update Organization
export const UpdateOrganizationRequest = Organization.mapFields(
  Struct.pick(["name", "metadata"]),
);
export const UpdateOrganizationResponse = GetOrganizationResponse;

export type GetOrganizationRequest = typeof GetOrganizationRequest.Type;
export type GetOrganizationResponse = typeof GetOrganizationResponse.Type;
export type CreateOrganizationRequest = typeof CreateOrganizationRequest.Type;
export type CreateOrganizationResponse = typeof CreateOrganizationResponse.Type;
export type ListUserOrganizationsResponse =
  typeof ListUserOrganizationsResponse.Type;
export type SetActiveOrganizationRequest =
  typeof SetActiveOrganizationRequest.Type;
export type SetActiveOrganizationResponse =
  typeof SetActiveOrganizationResponse.Type;
export type UpdateOrganizationRequest = typeof UpdateOrganizationRequest.Type;
export type UpdateOrganizationResponse = typeof UpdateOrganizationResponse.Type;
