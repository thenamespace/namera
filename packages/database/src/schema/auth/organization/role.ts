import type { OrganizationId, OrganizationRoleId, SystemRoleId } from "@namera-ai/protocol";
import type {
  OrganizationRoleKey,
  OrganizationRoleMetadata,
  OrganizationRoleType,
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
    type: text("type", { enum: ["system", "custom"] })
      .notNull()
      .$type<OrganizationRoleType>(),
    key: text("key").notNull().$type<OrganizationRoleKey>(),
    systemRoleId: text("system_role_id")
      .$type<SystemRoleId>()
      .references(() => systemRole.id, { onDelete: "restrict" }),
    permissions: text("permissions").array().$type<Permission>(),
    metadata: jsonb("metadata").notNull().$type<OrganizationRoleMetadata>(),
    ...timestamps,
  },
  (table) => [
    unique("organization_role_id_organization_unique").on(table.id, table.organizationId),
    uniqueIndex("organization_role_organization_key_uidx").on(table.organizationId, table.key),
    index("organization_role_system_role_idx").on(table.systemRoleId),
    check(
      "organization_role_source_check",
      sql`(
        (${table.type} = 'system' AND ${table.systemRoleId} IS NOT NULL AND ${table.permissions} IS NULL)
        OR
        (${table.type} = 'custom' AND ${table.systemRoleId} IS NULL AND ${table.permissions} IS NOT NULL)
      )`,
    ),
  ],
);
