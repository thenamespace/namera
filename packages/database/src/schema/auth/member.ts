import type {
  OrganizationId,
  OrganizationMemberId,
  UserId,
} from "@namera-ai/schema";

import { sql } from "drizzle-orm";
import { index, text, uniqueIndex } from "drizzle-orm/pg-core";

import { OrganizationMemberRole } from "@namera-ai/schema";

import { adminRole, generateUniqueId, timestamps, userRole } from "../common";
import {
  onlyOrgMember,
  onlyOrgMemberWithRoles,
  onlyIfSeedMember,
  or,
  PgPolicyBuilder,
} from "../policy";
import { authSchema } from "./common";
import { organization } from "./organization";
import { user } from "./user";

// Members table
// Represents a user's membership in an organization
export const member = authSchema.table.withRLS(
  "member",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(generateUniqueId)
      .$type<OrganizationMemberId>(),
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "cascade" }),
    role: text("role")
      .notNull()
      .$type<OrganizationMemberRole>()
      .default("member"),
    userId: text("user_id")
      .notNull()
      .$type<UserId>()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    index("member_organizationId_idx").on(table.organizationId),
    index("member_userId_idx").on(table.userId),
    uniqueIndex("member_user_organization_uidx").on(
      table.userId,
      table.organizationId,
    ),
    // Users can only select their own memberships
    new PgPolicyBuilder()
      .name("member_user_select")
      .as("permissive")
      .to(userRole)
      .forOperation("select")
      .using(onlyOrgMember(table.organizationId))
      .build(),
    // Only Org owner can insert members or if user is the first member
    new PgPolicyBuilder()
      .name("member_owner_insert")
      .as("permissive")
      .to(userRole)
      .forOperation("insert")
      .withCheck(
        or([
          onlyOrgMemberWithRoles(table.organizationId, ["owner"]),
          onlyIfSeedMember(table.organizationId, table.userId, table.role),
        ]),
      )
      .build(),
    // Only Org owner can update members
    new PgPolicyBuilder()
      .name("member_owner_update")
      .as("permissive")
      .to(userRole)
      .forOperation("update")
      .using(onlyOrgMemberWithRoles(table.organizationId, ["owner"]))
      .withCheck(onlyOrgMemberWithRoles(table.organizationId, ["owner"]))
      .build(),
    // Only Org owner can delete members
    new PgPolicyBuilder()
      .name("member_owner_delete")
      .as("permissive")
      .to(userRole)
      .forOperation("delete")
      .using(onlyOrgMemberWithRoles(table.organizationId, ["owner"]))
      .build(),
    // Admins can access all members
    new PgPolicyBuilder()
      .name("member_admin_access")
      .as("permissive")
      .to(adminRole)
      .forOperation("all")
      .using(sql`true`)
      .build(),
  ],
);
