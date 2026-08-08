import type {
  OrganizationId,
  OrganizationMemberId,
  OrganizationRoleId,
  UserId,
} from "@namera-ai/protocol";
import { sql } from "drizzle-orm";
import { text } from "drizzle-orm/pg-core";
import { foreignKey, index, uniqueIndex } from "drizzle-orm/pg-core";

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
    organizationRoleId: text("organization_role_id").notNull().$type<OrganizationRoleId>(),
    joinedAt: createTimestampField("joined_at").defaultNow().notNull(),
    removedAt: createTimestampField("removed_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("organization_member_active_organization_user_uidx")
      .on(table.organizationId, table.userId)
      .where(sql`${table.removedAt} IS NULL`),
    foreignKey({
      name: "organization_member_role_organization_fk",
      columns: [table.organizationRoleId, table.organizationId],
      foreignColumns: [organizationRole.id, organizationRole.organizationId],
    }).onDelete("restrict"),
    index("organization_member_user_idx").on(table.userId),
    index("organization_member_organization_role_idx").on(
      table.organizationRoleId,
      table.organizationId,
    ),
    index("organization_member_removed_at_idx").on(table.removedAt),
  ],
);
