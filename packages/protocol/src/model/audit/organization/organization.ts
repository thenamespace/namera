import { Schema } from "effect";

import { OrganizationId } from "#/common/index";

const OrganizationResource = {
  resourceType: Schema.Literal("organization"),
  resourceId: OrganizationId,
};

export const OrganizationCreatedEventData = Schema.Struct({
  event: Schema.Literal("organization.created"),
  ...OrganizationResource,
  data: Schema.Struct({
    version: Schema.Literal(1),
  }),
});

export const OrganizationUpdatedEventData = Schema.Struct({
  event: Schema.Literal("organization.updated"),
  ...OrganizationResource,
  data: Schema.Struct({
    version: Schema.Literal(1),
    changedFields: Schema.Array(Schema.Literal("metadata")),
  }),
});
