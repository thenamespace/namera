import type {
  OrganizationId,
  OrganizationRoleId,
  OrganizationRoleMetadata,
  Permission,
} from "@namera-ai/schema";

import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { authSchema } from "@/schema/auth/common";
import {
  adminRole,
  generateUniqueId,
  timestamps,
  userRole,
} from "@/schema/common";
import {
  and,
  onlyActorWithOrgAccess,
  onlyIfNotDeleted,
  PgPolicyBuilder,
} from "@/schema/policy";

import { organization } from "./organization";

// Organization Role Table
export const role = authSchema.table.withRLS(
  "role",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(generateUniqueId)
      .$type<OrganizationRoleId>(),
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    metadata: jsonb("metadata").notNull().$type<OrganizationRoleMetadata>(),
    permissions: text("permissions").array().notNull().$type<Permission[]>(),
    isSystem: boolean("is_system").notNull().default(false),
    version: integer("version").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("role_key_organizationId_idx")
      .on(table.key, table.organizationId)
      .where(sql`${table.deletedAt} IS NULL`),
    uniqueIndex("role_organization_id_id_uidx").on(
      table.organizationId,
      table.id,
    ),
    index("role_organization_system_idx").on(
      table.organizationId,
      table.isSystem,
    ),
    index("role_organizationId_idx").on(table.organizationId),
    new PgPolicyBuilder()
      .name("role_select")
      .as("permissive")
      .to(userRole)
      .forOperation("select")
      .using(
        and([
          onlyActorWithOrgAccess(table.organizationId),
          onlyIfNotDeleted(table.deletedAt),
        ]),
      )
      .build(),
    new PgPolicyBuilder()
      .name("role_update")
      .as("permissive")
      .to(userRole)
      .forOperation("update")
      .using(
        and([
          onlyActorWithOrgAccess(table.organizationId),
          onlyIfNotDeleted(table.deletedAt),
        ]),
      )
      .withCheck(
        and([
          onlyActorWithOrgAccess(table.organizationId),
          onlyIfNotDeleted(table.deletedAt),
        ]),
      )
      .build(),
    new PgPolicyBuilder()
      .name("role_insert")
      .as("permissive")
      .to(userRole)
      .forOperation("insert")
      .withCheck(
        and([
          onlyActorWithOrgAccess(table.organizationId),
          onlyIfNotDeleted(table.deletedAt),
        ]),
      )
      .build(),
    new PgPolicyBuilder()
      .name("role_admin_access")
      .as("permissive")
      .to(adminRole)
      .forOperation("all")
      .using(sql`true`)
      .build(),
  ],
);
