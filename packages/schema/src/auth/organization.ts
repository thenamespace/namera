import { Schema } from "effect";

import { MetadataIcon, MetadataName, OrganizationId, UserId } from "@/common";
import { createInsertSchema, createUpdateSchema } from "@/helpers";

export const OrganizationMetadata = Schema.Struct({
  logo: MetadataIcon,
});

export const OrganizationPlan = Schema.Literals(["free"]);

export const Organization = Schema.Struct({
  id: OrganizationId,
  name: MetadataName,
  metadata: OrganizationMetadata,
  plan: OrganizationPlan,
  createdById: Schema.NullOr(UserId),
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
  deletedAt: Schema.NullOr(Schema.Date),
});

export const OrganizationUpdate = createUpdateSchema(Organization);
export const OrganizationInsert = createInsertSchema(
  Organization,
  "name",
  "metadata",
  "plan",
  "createdById",
);

export type OrganizationMetadata = typeof OrganizationMetadata.Type;
export type OrganizationPlan = typeof OrganizationPlan.Type;
export type Organization = typeof Organization.Type;
export type OrganizationUpdate = typeof OrganizationUpdate.Type;
export type OrganizationInsert = typeof OrganizationInsert.Type;
