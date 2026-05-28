import { Schema, Struct } from "effect";

import { SystemRoleId } from "@/common";
import {
  MetadataName,
  MetadataLogo,
  MetadataDescription,
  TimestampFields,
} from "@/database/common";

import { createInsertSchema, createUpdateSchema } from "../helpers";
import { MemberPermission } from "./member-permissions";

export const SystemRoleKey = Schema.Literals(["owner", "admin", "member"]);
export const SystemRoleMetadata = Schema.Struct({
  name: MetadataName,
  description: MetadataDescription,
  logo: MetadataLogo,
});

export const SystemRole = Schema.Struct({
  id: SystemRoleId,
  key: SystemRoleKey,
  metadata: SystemRoleMetadata,
  version: Schema.Int,
  permissions: Schema.Array(MemberPermission),
}).mapFields(Struct.assign(TimestampFields));

export const SystemRoleUpdate = createUpdateSchema(SystemRole);
export const SystemRoleInsert = createInsertSchema(
  SystemRole,
  "key",
  "metadata",
  "version",
  "permissions",
);

export type SystemRoleKey = typeof SystemRoleKey.Type;
export type SystemRoleMetadata = typeof SystemRoleMetadata.Type;
export type SystemRole = typeof SystemRole.Type;
export type SystemRoleUpdate = typeof SystemRoleUpdate.Type;
export type SystemRoleInsert = typeof SystemRoleInsert.Type;
