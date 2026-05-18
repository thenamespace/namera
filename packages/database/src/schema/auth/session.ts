import type { OrganizationId, SessionId, UserId } from "@namera-ai/schema";

import { sql } from "drizzle-orm";
import { index, text } from "drizzle-orm/pg-core";

import {
  adminRole,
  createTimestampField,
  generateUniqueId,
  timestamps,
  userRole,
} from "../common";
import { and, onlyOrgMember, onlyUserId, or, PgPolicyBuilder } from "../policy";
import { authSchema } from "./common";
import { organization } from "./organization";
import { user } from "./user";

// Session Table
// Represents a user's session
// "insert" policies are not required because they are done by admin, as user does not have any means of
// authenticating themselves for session creation.
export const session = authSchema.table.withRLS(
  "session",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<SessionId>(),
    ipAddress: text("ip_address"),
    token: text("token").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .$type<UserId>()
      .references(() => user.id, { onDelete: "cascade" }),
    activeOrganizationId: text("active_organization_id")
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "set null" }),
    userAgent: text("user_agent"),
    expiresAt: createTimestampField("expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    ...timestamps,
  },
  (table) => [
    index("session_userId_idx").on(table.userId),
    // Users can only select their own sessions
    new PgPolicyBuilder()
      .name("session_select")
      .as("permissive")
      .to(userRole)
      .forOperation("select")
      .using(onlyUserId(table.userId))
      .build(),
    // Users can only update their own sessions
    new PgPolicyBuilder()
      .name("session_update")
      .as("permissive")
      .to(userRole)
      .forOperation("update")
      .using(onlyUserId(table.userId))
      .withCheck(
        and([
          onlyUserId(table.userId),
          // only org that user is part of
          or([
            sql`${table.activeOrganizationId} IS NULL`,
            onlyOrgMember(table.activeOrganizationId),
          ]),
        ]),
      )
      .build(),
    // Users can only delete their own sessions
    new PgPolicyBuilder()
      .name("session_delete")
      .as("permissive")
      .to(userRole)
      .forOperation("delete")
      .using(onlyUserId(table.userId))
      .build(),
    // Admins can access all sessions
    new PgPolicyBuilder()
      .name("session_access")
      .as("permissive")
      .to(adminRole)
      .forOperation("all")
      .using(sql`true`)
      .build(),
  ],
);
