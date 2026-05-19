import type {
  OrganizationId,
  OrganizationRoleId,
  OrganizationRoleMetadata,
  Permission,
} from "@namera-ai/schema";

import { sql } from "drizzle-orm";
import { index, json, text, uniqueIndex } from "drizzle-orm/pg-core";

import { authSchema } from "@/schema/auth/common";
import {
  adminRole,
  generateUniqueId,
  timestamps,
  userRole,
} from "@/schema/common";
import { onlyOrgMemberWithPermissions, PgPolicyBuilder } from "@/schema/policy";

import { organization } from "./organization";

// Organization Role Table
export const role = authSchema.table.withRLS(
  "role",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(generateUniqueId)
      .$type<OrganizationRoleId>(),
    name: text("name").notNull(),
    metadata: json("metadata").notNull().$type<OrganizationRoleMetadata>(),
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "cascade" }),
    permissions: text("permissions").array().notNull().$type<Permission>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("role_name_organizationId_idx").on(
      table.name,
      table.organizationId,
    ),
    uniqueIndex("role_organization_id_id_uidx").on(
      table.organizationId,
      table.id,
    ),
    index("role_organizationId_idx").on(table.organizationId),
    // Only members with "role:read" permission can select it
    new PgPolicyBuilder()
      .name("role_select")
      .as("permissive")
      .to(userRole)
      .forOperation("select")
      .using(onlyOrgMemberWithPermissions(table.organizationId, ["role:read"]))
      .build(),
    // Only members with "role:update" permission can update the organization
    new PgPolicyBuilder()
      .name("role_update")
      .as("permissive")
      .to(userRole)
      .forOperation("update")
      .using(
        onlyOrgMemberWithPermissions(table.organizationId, ["role:update"]),
      )
      .withCheck(
        onlyOrgMemberWithPermissions(table.organizationId, ["role:update"]),
      )
      .build(),
    // Only members with "role:create" permission can create roles
    new PgPolicyBuilder()
      .name("role_insert")
      .as("permissive")
      .to(userRole)
      .forOperation("insert")
      .withCheck(
        onlyOrgMemberWithPermissions(table.organizationId, ["role:create"]),
      )
      .build(),
    // Admins can access all roles
    new PgPolicyBuilder()
      .name("role_admin_access")
      .as("permissive")
      .to(adminRole)
      .forOperation("all")
      .using(sql`true`)
      .build(),
  ],
);
