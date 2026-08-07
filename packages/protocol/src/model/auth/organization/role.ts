import { Schema, Struct } from "effect";

import { OrganizationId, OrganizationRoleId, SystemRoleId } from "#/common/index";
import {
  MetadataDescription,
  MetadataLogo,
  MetadataName,
  OrganizationRoleKey,
  Permission,
  TimestampFields,
} from "#/model/common";
import { createInsertSchema, createUpdateSchema } from "#/model/helpers";

export const OrganizationRoleMetadata = Schema.Struct({
  version: Schema.Literal(1),
  name: MetadataName,
  logo: Schema.optionalKey(MetadataLogo),
  description: Schema.optionalKey(MetadataDescription),
});

export const OrganizationRoleType = Schema.Literals(["system", "custom"]);

export const OrganizationRole = Schema.Struct({
  id: OrganizationRoleId,
  organizationId: OrganizationId,
  type: OrganizationRoleType,
  key: OrganizationRoleKey,
  systemRoleId: Schema.NullOr(SystemRoleId),
  permissions: Schema.NullOr(Schema.Array(Permission)),
  metadata: OrganizationRoleMetadata,
}).mapFields(Struct.assign(TimestampFields));

export const OrganizationRoleUpdate = createUpdateSchema(OrganizationRole);
export const OrganizationRoleInsert = createInsertSchema(
  OrganizationRole,
  "organizationId",
  "type",
  "key",
  "systemRoleId",
  "permissions",
  "metadata",
);

export type OrganizationRoleMetadata = typeof OrganizationRoleMetadata.Type;
export type OrganizationRoleType = typeof OrganizationRoleType.Type;
export type OrganizationRole = typeof OrganizationRole.Type;
export type OrganizationRoleUpdate = typeof OrganizationRoleUpdate.Type;
export type OrganizationRoleInsert = typeof OrganizationRoleInsert.Type;
