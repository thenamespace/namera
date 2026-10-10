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

export const BillingPlanChangedEventData = Schema.Struct({
  event: Schema.Literal("billing.plan_changed"),
  ...OrganizationResource,
  data: Schema.Struct({
    version: Schema.Literal(1),
    plan: Schema.Literal("free"),
    previousPlanVersion: Schema.Literal(1),
    planVersion: Schema.Literal(2),
    effectiveAt: Schema.DateTimeUtcFromString,
  }),
});
