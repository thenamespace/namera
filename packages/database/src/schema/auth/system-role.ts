import type { SystemRoleId } from "@namera-ai/schema";
import type {
  OrganizationRoleMetadata,
  MemberPermission,
  SystemRoleKey,
} from "@namera-ai/schema/database";

import { sql } from "drizzle-orm";
import { integer, jsonb, text, uniqueIndex } from "drizzle-orm/pg-core";

import { authSchema } from "@/schema/auth/common";
import {
  adminRole,
  generateUniqueId,
  timestamps,
  userRole,
} from "@/schema/common";
import { and, onlyIfNotDeleted, PgPolicyBuilder } from "@/schema/policy";

// Organization Role Table
export const systemRole = authSchema.table.withRLS(
  "system_role",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(generateUniqueId)
      .$type<SystemRoleId>(),
    key: text("key").notNull().$type<SystemRoleKey>(),
    permissions: text("permissions")
      .array()
      .notNull()
      .$type<MemberPermission>(),
    metadata: jsonb("metadata").notNull().$type<OrganizationRoleMetadata>(),
    version: integer("version").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("system_role_key_key_idx")
      .on(table.key)
      .where(sql`${table.deletedAt} IS NULL`),
    new PgPolicyBuilder()
      .name("system_role_select")
      .as("permissive")
      .to(userRole)
      .forOperation("select")
      .using(and([onlyIfNotDeleted(table.deletedAt)]))
      .build(),
    new PgPolicyBuilder()
      .name("system_role_admin_access")
      .as("permissive")
      .to(adminRole)
      .forOperation("all")
      .using(sql`true`)
      .build(),
  ],
);
