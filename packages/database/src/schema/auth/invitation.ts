import type {
  Email,
  InvitationId,
  OrganizationId,
  OrganizationRoleId,
  UserId,
} from "@namera-ai/schema";
import type { InvitationStatus } from "@namera-ai/schema/database";

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

import { organization } from "./organization";
import { role } from "./role";

// Invitations table
// Represents an invitation to join an organization
export const invitation = authSchema.table.withRLS(
  "invitation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(generateUniqueId)
      .$type<InvitationId>(),
    email: text("email").notNull().$type<Email>(),
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "cascade" }),
    roleId: text("role_id").notNull().$type<OrganizationRoleId>(),
    inviterId: text("inviter_id")
      .notNull()
      .$type<UserId>()
      .references(() => user.id, { onDelete: "no action" }),
    status: text("status")
      .notNull()
      .$type<InvitationStatus>()
      .default("pending"),
    expiresAt: createTimestampField("expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.organizationId, table.roleId],
      foreignColumns: [role.organizationId, role.id],
      name: "invitation_organization_role_fk",
    }),
    index("invitation_organizationId_idx").on(table.organizationId),
    index("invitation_email_idx").on(table.email),
    index("invitation_organization_status_idx").on(
      table.organizationId,
      table.status,
    ),
    index("invitation_email_status_idx").on(table.email, table.status),
    uniqueIndex("invitation_pending_organization_email_uidx")
      .on(table.organizationId, table.email)
      .where(sql`${table.status} = 'pending' AND ${table.deletedAt} IS NULL`),
    new PgPolicyBuilder()
      .name("invitation_select")
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
      .name("invitation_insert")
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
      .name("invitation_update")
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
      .name("invitation_admin_access")
      .as("permissive")
      .to(adminRole)
      .forOperation("all")
      .using(sql`true`)
      .build(),
  ],
);
