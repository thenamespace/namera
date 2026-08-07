import type {
  OrganizationId,
  OrganizationMemberId,
  OrganizationRoleId,
  UserId,
} from "@namera-ai/protocol";
import { sql } from "drizzle-orm";
import { text } from "drizzle-orm/pg-core";
import { index, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId, timestamps } from "#/schema/common";

import { authSchema } from "../common.js";
import { user } from "../core/index.js";
import { organization } from "./organization.js";
import { organizationRole } from "./role.js";

export const organizationMember = authSchema.table(
  "organization_member",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<OrganizationMemberId>(),
    userId: text("user_id")
      .notNull()
      .$type<UserId>()
      .references(() => user.id, { onDelete: "restrict" }),
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "restrict" }),
    organizationRoleId: text("organization_role_id")
      .notNull()
      .$type<OrganizationRoleId>()
      .references(() => organizationRole.id, { onDelete: "restrict" }),
    joinedAt: createTimestampField("joined_at").defaultNow().notNull(),
    removedAt: createTimestampField("removed_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("organization_member_active_organization_user_uidx")
      .on(table.organizationId, table.userId)
      .where(sql`${table.removedAt} IS NULL`),
    index("organization_member_user_idx").on(table.userId),
    index("organization_member_organization_role_idx").on(
      table.organizationId,
      table.organizationRoleId,
    ),
    index("organization_member_removed_at_idx").on(table.removedAt),
  ],
);
