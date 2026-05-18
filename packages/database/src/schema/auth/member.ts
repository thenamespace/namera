import type {
  OrganizationId,
  OrganizationMemberId,
  OrganizationRoleId,
  UserId,
} from "@namera-ai/schema";

import { sql } from "drizzle-orm";
import { foreignKey, index, text, uniqueIndex } from "drizzle-orm/pg-core";

import { adminRole, generateUniqueId, timestamps, userRole } from "../common";
import { onlyOrgMemberWithPermissions, PgPolicyBuilder } from "../policy";
import { authSchema } from "./common";
import { role } from "./role";
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
    organizationId: text("organization_id").notNull().$type<OrganizationId>(),
    roleId: text("role_id").notNull().$type<OrganizationRoleId>(),
    userId: text("user_id")
      .notNull()
      .$type<UserId>()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.organizationId, table.roleId],
      foreignColumns: [role.organizationId, role.id],
      name: "member_organization_role_fk",
    }),
    index("member_organizationId_idx").on(table.organizationId),
    index("member_userId_idx").on(table.userId),
    uniqueIndex("member_user_organization_uidx").on(
      table.userId,
      table.organizationId,
    ),
    // Only Member with "member:read" permission can select members
    new PgPolicyBuilder()
      .name("member_select")
      .as("permissive")
      .to(userRole)
      .forOperation("select")
      .using(
        onlyOrgMemberWithPermissions(table.organizationId, ["member:read"]),
      )
      .build(),
    // Only Member with "member:invite" permission can insert members or if user is the first member
    new PgPolicyBuilder()
      .name("member_insert")
      .as("permissive")
      .to(userRole)
      .forOperation("insert")
      .withCheck(
        onlyOrgMemberWithPermissions(table.organizationId, ["member:invite"]), // TODO: check this.
      )
      .build(),
    // Only Member with "member:update" permission can update members
    new PgPolicyBuilder()
      .name("member_update")
      .as("permissive")
      .to(userRole)
      .forOperation("update")
      .using(
        onlyOrgMemberWithPermissions(table.organizationId, ["member:update"]),
      )
      .withCheck(
        onlyOrgMemberWithPermissions(table.organizationId, ["member:update"]),
      )
      .build(),
    // Only Member with "member:remove" permission can delete members
    new PgPolicyBuilder()
      .name("member_delete")
      .as("permissive")
      .to(userRole)
      .forOperation("delete")
      .using(
        onlyOrgMemberWithPermissions(table.organizationId, ["member:remove"]),
      )
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
