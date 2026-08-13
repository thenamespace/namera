import { Schema, Struct } from "effect";

import { OrganizationId, UserId } from "#/common/index";
import { MetadataDescription, MetadataLogo, MetadataName, TimestampFields } from "#/model/common";

export const OrganizationMetadata = Schema.Struct({
  version: Schema.Literal(1),
  name: MetadataName,
  logo: Schema.optionalKey(MetadataLogo),
  description: Schema.optionalKey(MetadataDescription),
});
export const Organization = Schema.Struct({
  id: OrganizationId,
  metadata: OrganizationMetadata,
  createdById: UserId,
}).mapFields(Struct.assign(TimestampFields));

export const OrganizationInsert = Schema.Struct({
  metadata: OrganizationMetadata,
  createdById: UserId,
});

export const OrganizationUpdate = Schema.Struct({
  metadata: OrganizationMetadata,
});

export type OrganizationMetadata = typeof OrganizationMetadata.Type;
export type Organization = typeof Organization.Type;
export type OrganizationUpdate = typeof OrganizationUpdate.Type;
export type OrganizationInsert = typeof OrganizationInsert.Type;
