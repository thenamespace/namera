import { Schema, Struct } from "effect";

import { OrganizationId, UserId } from "#/common/index";
import { MetadataDescription, MetadataLogo, MetadataName, TimestampFields } from "#/model/common";

export const OrganizationMetadata = Schema.Struct({
  version: Schema.Literal(1),
  name: MetadataName,
  logo: Schema.optionalKey(MetadataLogo),
  description: Schema.optionalKey(MetadataDescription),
});
export const OrganizationPlan = Schema.Literals(["free"]);

export const Organization = Schema.Struct({
  id: OrganizationId,
  metadata: OrganizationMetadata,
  plan: OrganizationPlan,
  createdById: UserId,
}).mapFields(Struct.assign(TimestampFields));

export const OrganizationInsert = Schema.Struct({
  metadata: OrganizationMetadata,
  plan: Schema.optionalKey(OrganizationPlan),
  createdById: UserId,
});

export const OrganizationUpdate = Schema.Struct({
  metadata: OrganizationMetadata,
});

export type OrganizationMetadata = typeof OrganizationMetadata.Type;
export type OrganizationPlan = typeof OrganizationPlan.Type;
export type Organization = typeof Organization.Type;
export type OrganizationUpdate = typeof OrganizationUpdate.Type;
export type OrganizationInsert = typeof OrganizationInsert.Type;
