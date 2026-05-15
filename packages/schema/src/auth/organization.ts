import { Schema } from "effect";

import { OrganizationId, OrganizationSlug } from "@/common";
import { createInsertSchema, createUpdateSchema } from "@/helpers";

export const OrganizationMetadata = Schema.Struct({
  name: Schema.optional(Schema.String),
  logo: Schema.optional(Schema.String),
});

export const OrganizationPlan = Schema.Literals(["free"]);

export const Organization = Schema.Struct({
  id: OrganizationId,
  metadata: Schema.NullOr(OrganizationMetadata),
  plan: OrganizationPlan,
  slug: OrganizationSlug,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
});

export type OrganizationMetadata = typeof OrganizationMetadata.Type;
export type OrganizationPlan = typeof OrganizationPlan.Type;

export const OrganizationUpdate = createUpdateSchema(Organization);
export const OrganizationInsert = createInsertSchema(
  Organization,
  "metadata",
  "plan",
  "slug",
);

export type Organization = typeof Organization.Type;
export type OrganizationUpdate = typeof OrganizationUpdate.Type;
export type OrganizationInsert = typeof OrganizationInsert.Type;
