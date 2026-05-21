import { Schema } from "effect";

import {
  MetadataDescription,
  MetadataIcon,
  MetadataName,
  OrganizationId,
  OrganizationRoleId,
} from "@/common";
import { createInsertSchema, createUpdateSchema } from "@/helpers";

import { Permission } from "./permissions";

export const OrganizationRoleMetadata = Schema.Struct({
  name: MetadataName,
  logo: MetadataIcon,
  description: Schema.optional(MetadataDescription),
});

export const OrganizationRole = Schema.Struct({
  id: OrganizationRoleId,
  organizationId: OrganizationId,
  key: Schema.String.check(
    Schema.isPattern(/^[a-zA-Z0-9-_]+$/, {
      message:
        "Key must be alphanumeric and can contain hyphens and underscores",
    }),
    Schema.isLengthBetween(3, 128, {
      message: "Key must be between 3 and 128 characters long",
    }),
  ),
  permissions: Schema.Array(Permission),
  metadata: OrganizationRoleMetadata,
  isSystem: Schema.Boolean,
  version: Schema.Int,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
  deletedAt: Schema.NullOr(Schema.Date),
});

export const OrganizationRoleUpdate = createUpdateSchema(OrganizationRole);
export const OrganizationRoleInsert = createInsertSchema(
  OrganizationRole,
  "organizationId",
  "key",
  "permissions",
  "metadata",
);

export type OrganizationRoleMetadata = typeof OrganizationRoleMetadata.Type;
export type OrganizationRole = typeof OrganizationRole.Type;
export type OrganizationRoleUpdate = typeof OrganizationRoleUpdate.Type;
export type OrganizationRoleInsert = typeof OrganizationRoleInsert.Type;
