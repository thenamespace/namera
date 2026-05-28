import { Schema, Struct } from "effect";

import { OrganizationId, OrganizationRoleId, SystemRoleId } from "@/common";
import {
  MetadataDescription,
  MetadataLogo,
  MetadataName,
  TimestampFields,
} from "@/database/common";
import { createInsertSchema, createUpdateSchema } from "@/database/helpers";

import { MemberPermission } from "./member-permissions";

export const OrganizationRoleMetadata = Schema.Struct({
  name: MetadataName,
  logo: MetadataLogo,
  description: Schema.optional(MetadataDescription),
});

const OrganizationRoleKey = Schema.String.check(
  Schema.isPattern(/^[a-z0-9-_]+$/, {
    message: "Key must be alphanumeric and can contain hyphens and underscores",
  }),
  Schema.isLengthBetween(3, 128, {
    message: "Key must be between 3 and 128 characters long",
  }),
);

export const OrganizationRoleType = Schema.Literals(["system", "custom"]);

export const OrganizationRole = Schema.Struct({
  id: OrganizationRoleId,
  organizationId: OrganizationId,
  type: OrganizationRoleType,
  key: OrganizationRoleKey,
  systemRoleId: Schema.NullOr(SystemRoleId),
  permissions: Schema.Array(MemberPermission),
  metadata: OrganizationRoleMetadata,
  version: Schema.Int,
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
  "version",
);

export type OrganizationRoleMetadata = typeof OrganizationRoleMetadata.Type;
export type OrganizationRoleType = typeof OrganizationRoleType.Type;
export type OrganizationRole = typeof OrganizationRole.Type;
export type OrganizationRoleUpdate = typeof OrganizationRoleUpdate.Type;
export type OrganizationRoleInsert = typeof OrganizationRoleInsert.Type;
