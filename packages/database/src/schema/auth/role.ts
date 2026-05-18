import type {
  OrganizationId,
  OrganizationRoleId,
  OrganizationRoleMetadata,
  Permission,
} from "@namera-ai/schema";

import { sql } from "drizzle-orm";
import { index, json, text } from "drizzle-orm/pg-core";

import { adminRole, generateUniqueId, timestamps, userRole } from "../common";
import {
  onlyOrgMember,
  onlyOrgMemberWithRoles,
  PgPolicyBuilder,
} from "../policy";
import { authSchema } from "./common";
import { organization } from "./organization";

// Organization Role Table
export const organizationRole = authSchema.table.withRLS(
  "organization_role",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(generateUniqueId)
      .$type<OrganizationRoleId>(),
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "cascade" }),
    metadata: json("metadata").$type<OrganizationRoleMetadata>(),
    permissions: text("permissions").array().notNull().$type<Permission>(),
    ...timestamps,
  },
  (table) => [
    index("role_organizationId_idx").on(table.organizationId),
    // Only members of an organization can select it
    new PgPolicyBuilder()
      .name("role_select")
      .as("permissive")
      .to(userRole)
      .forOperation("select")
      .using(onlyOrgMember(table.organizationId))
      .build(),

    // Only owner can update the organization
    new PgPolicyBuilder()
      .name("role_update")
      .as("permissive")
      .to(userRole)
      .forOperation("update")
      .using(onlyOrgMemberWithRoles(table.id, ["owner"]))
      .withCheck(onlyOrgMemberWithRoles(table.id, ["owner"]))
      .build(),
    // Only Org Owner can delete the organization
    new PgPolicyBuilder()
      .name("organization_owner_delete")
      .as("permissive")
      .to(userRole)
      .forOperation("delete")
      .using(onlyOrgMemberWithRoles(table.id, ["owner"]))
      .build(),
    // Admins can access all organizations
    new PgPolicyBuilder()
      .name("organization_admin_access")
      .as("permissive")
      .to(adminRole)
      .forOperation("all")
      .using(sql`true`)
      .build(),
  ],
);
