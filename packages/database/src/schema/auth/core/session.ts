import type { OrganizationId, SessionId, UserId } from "@namera-ai/protocol";
import { sql } from "drizzle-orm";
import { text, index, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId, timestamps } from "#/schema/common";

import { authSchema } from "../common.js";
import { organization } from "../organization/index.js";
import { user } from "./user.js";

export const session = authSchema.table(
  "session",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<SessionId>(),
    userId: text("user_id")
      .notNull()
      .$type<UserId>()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    activeOrganizationId: text("active_organization_id")
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "set null" }),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    expiresAt: createTimestampField("expires_at").notNull(),
    revokedAt: createTimestampField("revoked_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("session_token_uidx").on(table.token),
    index("session_user_active_idx").on(table.userId, table.expiresAt),
    index("session_active_user_created_at_idx")
      .on(table.userId, table.createdAt.desc())
      .where(sql`${table.revokedAt} IS NULL`),
    index("session_active_organization_idx").on(table.activeOrganizationId),
    index("session_expires_at_idx").on(table.expiresAt),
  ],
);
