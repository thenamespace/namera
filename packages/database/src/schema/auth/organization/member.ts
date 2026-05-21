import type {
  OrganizationId,
  OrganizationMemberId,
  OrganizationRoleId,
  UserId,
} from "@namera-ai/schema";

import { sql } from "drizzle-orm";
import { foreignKey, index, text, uniqueIndex } from "drizzle-orm/pg-core";

import { authSchema } from "@/schema/auth/common";
import { user } from "@/schema/auth/user";
import {
  adminRole,
  createTimestampField,
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

import { role } from "./role";

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
    // Timestamps
    joinedAt: createTimestampField("joined_at", {
      mode: "date",
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
    removedAt: createTimestampField("removed_at", {
      mode: "date",
      withTimezone: true,
    }),
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
    uniqueIndex("member_user_organization_uidx")
      .on(table.userId, table.organizationId)
      .where(sql`${table.deletedAt} IS NULL AND ${table.removedAt} IS NULL`),
    index("member_active_organization_user_idx")
      .on(table.organizationId, table.userId)
      .where(sql`${table.deletedAt} IS NULL AND ${table.removedAt} IS NULL`),
    new PgPolicyBuilder()
      .name("member_select")
      .as("permissive")
      .to(userRole)
      .forOperation("select")
      .using(
        and([
          onlyActorWithOrgAccess(table.organizationId),
          onlyIfNotDeleted(table.deletedAt),
          sql`${table.removedAt} IS NULL`,
        ]),
      )
      .build(),
    new PgPolicyBuilder()
      .name("member_insert")
      .as("permissive")
      .to(userRole)
      .forOperation("insert")
      .withCheck(
        and([
          onlyActorWithOrgAccess(table.organizationId),
          onlyIfNotDeleted(table.deletedAt),
          sql`${table.removedAt} IS NULL`,
        ]),
      )
      .build(),
    new PgPolicyBuilder()
      .name("member_update")
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
