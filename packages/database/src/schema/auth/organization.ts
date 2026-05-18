import type {
  OrganizationId,
  OrganizationMetadata,
  OrganizationSlug,
} from "@namera-ai/schema";

import { sql } from "drizzle-orm";
import { json, text, uniqueIndex } from "drizzle-orm/pg-core";

import { OrganizationPlan } from "@namera-ai/schema";

import { adminRole, generateUniqueId, timestamps, userRole } from "../common";
import { onlyOrgMemberWithPermissions, PgPolicyBuilder } from "../policy";
import { authSchema } from "./common";

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
    metadata: json("metadata").$type<OrganizationMetadata>(),
    plan: text("plan").notNull().$type<OrganizationPlan>(),
    slug: text("slug").notNull().$type<OrganizationSlug>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("organization_slug_uidx").on(table.slug),
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
    // Only member with org:delete permission can delete the organization
    new PgPolicyBuilder()
      .name("organization_delete")
      .as("permissive")
      .to(userRole)
      .forOperation("delete")
      .using(onlyOrgMemberWithPermissions(table.id, ["org:delete"]))
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
