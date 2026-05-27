import { Schema, Struct } from "effect";

import { OrganizationId, UserId } from "@/common";
import { MetadataLogo, MetadataName, TimestampFields } from "@/database/common";
import { createInsertSchema, createUpdateSchema } from "@/database/helpers";

export const OrganizationMetadata = Schema.Struct({
  logo: MetadataLogo,
});
export const OrganizationPlan = Schema.Literals(["free"]);

export const Organization = Schema.Struct({
  id: OrganizationId,
  name: MetadataName,
  metadata: OrganizationMetadata,
  plan: OrganizationPlan,
  createdById: UserId,
}).mapFields(Struct.assign(TimestampFields));

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
