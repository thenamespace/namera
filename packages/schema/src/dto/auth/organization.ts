import { Schema, Struct } from "effect";

import {
  Organization,
  OrganizationInsert,
  OrganizationMember,
  OrganizationSlug,
} from "@/auth";
import { OrganizationId } from "@/common";

export class OrganizationError extends Schema.TaggedErrorClass<OrganizationError>()(
  "OrganizationError",
  {
    code: Schema.Literals([
      "SLUG_ALREADY_TAKEN",
      "ORG_LIMIT_REACHED",
      "ORGANIZATION_NOT_FOUND",
      "ORGANIZATION_MEMBER_NOT_FOUND",
      "ORGANIZATION_PERMISSION_DENIED",
    ]),
    message: Schema.optional(Schema.String),
  },
) {}

// Create Organization
export const CreateOrganizationRequest = OrganizationInsert.mapFields(
  Struct.pick(["name", "metadata", "slug"]),
);

export const CreateOrganizationResponse = Organization;

// Check if slug is available
export const CheckOrganizationSlugRequest = Schema.Struct({
  slug: OrganizationSlug,
});
export const CheckOrganizationSlugResponse = Schema.Struct({
  isAvailable: Schema.Boolean,
});

// List user's organizations
export const ListOrganizationsRequest = Schema.Undefined;
export const ListOrganizationsResponse = Schema.Array(
  OrganizationMember.mapFields(Struct.assign({ organization: Organization })),
);

// Set current user's active organization
export const SetActiveOrganizationRequest = Schema.Struct({
  id: OrganizationId,
  slug: OrganizationSlug,
});
export const SetActiveOrganizationResponse = Schema.Void;

// Get Organization
export const GetFullOrganizationRequest = Schema.Struct({
  id: OrganizationId,
  slug: OrganizationSlug,
  membersLimit: Schema.Int.check(
    Schema.isBetween(
      { minimum: 1, maximum: 100 },
      {
        message: "Members limit must be between 1 and 100",
      },
    ),
  ),
});
export const GetFullOrganizationResponse = Organization;

// Update Organization
export const UpdateOrganizationRequest = Schema.Struct({
  id: OrganizationId,
  data: Organization.mapFields(Struct.pick(["name", "metadata"])),
});
export const UpdateOrganizationResponse = Organization;

// Delete Organization
export const DeleteOrganizationRequest = Schema.Struct({
  id: OrganizationId,
});
export const DeleteOrganizationResponse = Schema.Void;

export type CreateOrganizationRequest = typeof CreateOrganizationRequest.Type;
export type CreateOrganizationResponse = typeof CreateOrganizationResponse.Type;
export type CheckOrganizationSlugRequest =
  typeof CheckOrganizationSlugRequest.Type;
export type CheckOrganizationSlugResponse =
  typeof CheckOrganizationSlugResponse.Type;
export type ListOrganizationsRequest = typeof ListOrganizationsRequest.Type;
export type ListOrganizationsResponse = typeof ListOrganizationsResponse.Type;
export type SetActiveOrganizationRequest =
  typeof SetActiveOrganizationRequest.Type;
export type SetActiveOrganizationResponse =
  typeof SetActiveOrganizationResponse.Type;
export type GetFullOrganizationRequest = typeof GetFullOrganizationRequest.Type;
export type GetFullOrganizationResponse =
  typeof GetFullOrganizationResponse.Type;
export type UpdateOrganizationRequest = typeof UpdateOrganizationRequest.Type;
export type UpdateOrganizationResponse = typeof UpdateOrganizationResponse.Type;
export type DeleteOrganizationRequest = typeof DeleteOrganizationRequest.Type;
export type DeleteOrganizationResponse = typeof DeleteOrganizationResponse.Type;
