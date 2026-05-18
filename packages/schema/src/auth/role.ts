import { Schema } from "effect";

import { MetadataIcon, OrganizationId, OrganizationRoleId } from "@/common";
import { createInsertSchema, createUpdateSchema } from "@/helpers";

import { Permission } from "./permissions";

export const OrganizationRoleMetadata = Schema.Struct({
  name: Schema.String.check(
    Schema.isPattern(/^[a-zA-Z0-9-_]+$/, {
      message:
        "Name must be alphanumeric and can contain hyphens and underscores",
    }),
    Schema.isLengthBetween(3, 128, {
      message: "Name must be between 3 and 128 characters long",
    }),
  ),
  logo: MetadataIcon,
});

export const OrganizationRole = Schema.Struct({
  id: OrganizationRoleId,
  metadata: OrganizationRoleMetadata,
  organizationId: OrganizationId,
  permissions: Schema.Array(Permission),
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
});

export const OrganizationRoleUpdate = createUpdateSchema(OrganizationRole);
export const OrganizationRoleInsert = createInsertSchema(
  OrganizationRole,
  "metadata",
  "organizationId",
  "permissions",
);

export type OrganizationRoleMetadata = typeof OrganizationRoleMetadata.Type;
export type OrganizationRole = typeof OrganizationRole.Type;
export type OrganizationRoleUpdate = typeof OrganizationRoleUpdate.Type;
export type OrganizationRoleInsert = typeof OrganizationRoleInsert.Type;
