import { Schema, Struct } from "effect";

import { SystemRoleId } from "#/common/index";
import { MetadataDescription, MetadataName, Permission, TimestampFields } from "#/model/common";
import { createInsertSchema, createUpdateSchema } from "#/model/helpers";

export const SystemRoleKey = Schema.Literals(["owner", "admin", "member"]);
export const SystemRoleMetadata = Schema.Struct({
  version: Schema.Literal(1),
  name: MetadataName,
  description: Schema.optionalKey(MetadataDescription),
});

export const SystemRole = Schema.Struct({
  id: SystemRoleId,
  key: SystemRoleKey,
  metadata: SystemRoleMetadata,
  permissions: Schema.Array(Permission),
}).mapFields(Struct.assign(TimestampFields));

export const SystemRoleUpdate = createUpdateSchema(SystemRole);
export const SystemRoleInsert = createInsertSchema(SystemRole, "key", "metadata", "permissions");

export type SystemRoleKey = typeof SystemRoleKey.Type;
export type SystemRoleMetadata = typeof SystemRoleMetadata.Type;
export type SystemRole = typeof SystemRole.Type;
export type SystemRoleUpdate = typeof SystemRoleUpdate.Type;
export type SystemRoleInsert = typeof SystemRoleInsert.Type;
