import type { OrganizationId, OrganizationRoleId, SystemRoleId } from "@namera-ai/protocol";
import type {
  OrganizationRoleKey,
  OrganizationRoleMetadata,
  Permission,
} from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { text, jsonb } from "drizzle-orm/pg-core";
import { check, index, unique, uniqueIndex } from "drizzle-orm/pg-core";

import { generateUniqueId, timestamps } from "#/schema/common";

import { authSchema } from "../common.js";
import { organization } from "./organization.js";
import { systemRole } from "./system-role.js";

export const organizationRole = authSchema.table(
  "organization_role",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<OrganizationRoleId>(),
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "restrict" }),
    key: text("key").$type<OrganizationRoleKey>(),
    systemRoleId: text("system_role_id")
      .$type<SystemRoleId>()
      .references(() => systemRole.id, { onDelete: "restrict" }),
    permissions: text("permissions").array().$type<Permission>(),
    metadata: jsonb("metadata").$type<OrganizationRoleMetadata>(),
    ...timestamps,
  },
  (table) => [
    unique("organization_role_id_organization_unique").on(table.id, table.organizationId),
    uniqueIndex("organization_role_organization_system_role_uidx")
      .on(table.organizationId, table.systemRoleId)
      .where(sql`${table.systemRoleId} IS NOT NULL`),
    uniqueIndex("organization_role_organization_custom_key_uidx")
      .on(table.organizationId, table.key)
      .where(sql`${table.systemRoleId} IS NULL`),
    index("organization_role_system_role_idx").on(table.systemRoleId),
    check(
      "organization_role_source_check",
      sql`(
        (${table.systemRoleId} IS NOT NULL AND ${table.key} IS NULL AND ${table.metadata} IS NULL AND ${table.permissions} IS NULL)
        OR
        (${table.systemRoleId} IS NULL AND ${table.key} IS NOT NULL AND ${table.metadata} IS NOT NULL AND ${table.permissions} IS NOT NULL)
      )`,
    ),
    check(
      "organization_role_custom_key_not_system_check",
      sql`${table.systemRoleId} IS NOT NULL OR ${table.key} NOT IN ('owner', 'admin', 'member')`,
    ),
  ],
);
