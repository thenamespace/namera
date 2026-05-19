import type {
  OrganizationId,
  OrganizationMetadata,
  OrganizationSlug,
  UserId,
} from "@namera-ai/schema";

import { sql } from "drizzle-orm";
import { json, text, uniqueIndex } from "drizzle-orm/pg-core";

import { authSchema } from "@/schema/auth/common";
import { user } from "@/schema/auth/user";
import {
  adminRole,
  generateUniqueId,
  lower,
  timestamps,
  userRole,
} from "@/schema/common";
import { onlyOrgMemberWithPermissions, PgPolicyBuilder } from "@/schema/policy";
import { OrganizationPlan } from "@namera-ai/schema";

// Organization Table
// Represents an organization
// "insert" policies are not required because they are done by admin
export const organization = authSchema.table.withRLS(
  "organization",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(generateUniqueId)
      .$type<OrganizationId>(),
    name: text("name").notNull(),
    metadata: json("metadata").$type<OrganizationMetadata>(),
    plan: text("plan").notNull().$type<OrganizationPlan>(),
    slug: text("slug").notNull().$type<OrganizationSlug>(),
    createdById: text("created_by_id")
      .$type<UserId>()
      .references(() => user.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("organization_slug_uidx").on(lower(table.slug)),
    // Only members with "org:read" permission can select it
    new PgPolicyBuilder()
      .name("organization_select")
      .as("permissive")
      .to(userRole)
      .forOperation("select")
      .using(onlyOrgMemberWithPermissions(table.id, ["org:read"]))
      .build(),
    // Only member with org:update permission can update the organization
    new PgPolicyBuilder()
      .name("organization_update")
      .as("permissive")
      .to(userRole)
      .forOperation("update")
      .using(onlyOrgMemberWithPermissions(table.id, ["org:update"]))
      .withCheck(onlyOrgMemberWithPermissions(table.id, ["org:update"]))
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
