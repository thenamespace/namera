import { Schema } from "effect";

import { OrganizationId, OrganizationRoleId, SystemRoleId } from "#/common/index";
import {
  MetadataDescription,
  MetadataLogo,
  MetadataName,
  OrganizationRoleKey,
  TimestampFields,
} from "#/model/common";

export const MemberPermission = Schema.Literals([
  "organization:read",
  "organization:update",
  "member:read",
  "member:update",
  "member:remove",
  "invitation:read",
  "invitation:create",
  "invitation:cancel",
  "role:read",
  "role:create",
  "role:update",
  "role:delete",
  "billing:read",
  "billing:update",
  "billing:cancel",
]);

export const OrganizationRoleMetadata = Schema.Struct({
  version: Schema.Literal(1),
  name: MetadataName,
  logo: Schema.optionalKey(MetadataLogo),
  description: Schema.optionalKey(MetadataDescription),
});

export const OrganizationRoleType = Schema.Literals(["system", "custom"]);

const OrganizationRoleFields = {
  id: OrganizationRoleId,
  organizationId: OrganizationId,
  key: OrganizationRoleKey,
  permissions: Schema.Array(MemberPermission),
  metadata: OrganizationRoleMetadata,
  ...TimestampFields,
};

export const OrganizationRole = Schema.Union([
  Schema.Struct({
    ...OrganizationRoleFields,
    type: Schema.Literal("system"),
    systemRoleId: SystemRoleId,
  }),
  Schema.Struct({
    ...OrganizationRoleFields,
    type: Schema.Literal("custom"),
    systemRoleId: Schema.Null,
  }),
]);

export const SystemOrganizationRoleInsert = Schema.Struct({
  organizationId: OrganizationId,
  systemRoleId: SystemRoleId,
});

export const CustomOrganizationRoleInsert = Schema.Struct({
  organizationId: OrganizationId,
  key: OrganizationRoleKey,
  permissions: Schema.Array(MemberPermission),
  metadata: OrganizationRoleMetadata,
});

export const OrganizationRoleInsert = Schema.Union([
  SystemOrganizationRoleInsert,
  CustomOrganizationRoleInsert,
]);

export const OrganizationRoleUpdate = Schema.Struct({
  key: Schema.optionalKey(OrganizationRoleKey),
  permissions: Schema.optionalKey(Schema.Array(MemberPermission)),
  metadata: Schema.optionalKey(OrganizationRoleMetadata),
});

export type OrganizationRoleMetadata = typeof OrganizationRoleMetadata.Type;
export type OrganizationRoleType = typeof OrganizationRoleType.Type;
export type OrganizationRole = typeof OrganizationRole.Type;
export type MemberPermission = typeof MemberPermission.Type;
export type SystemOrganizationRoleInsert = typeof SystemOrganizationRoleInsert.Type;
export type CustomOrganizationRoleInsert = typeof CustomOrganizationRoleInsert.Type;
export type OrganizationRoleUpdate = typeof OrganizationRoleUpdate.Type;
export type OrganizationRoleInsert = typeof OrganizationRoleInsert.Type;
