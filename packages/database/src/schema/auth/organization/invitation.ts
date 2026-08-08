import type {
  Email,
  InvitationId,
  OrganizationId,
  OrganizationRoleId,
  UserId,
} from "@namera-ai/protocol";
import type { InvitationStatus } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, foreignKey, index, text, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId, timestamps } from "#/schema/common";

import { authSchema } from "../common.js";
import { user } from "../core/index.js";
import { organization } from "./organization.js";
import { organizationRole } from "./role.js";

export const invitation = authSchema.table(
  "invitation",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<InvitationId>(),
    email: text("email").notNull().$type<Email>(),
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "restrict" }),
    organizationRoleId: text("organization_role_id").notNull().$type<OrganizationRoleId>(),
    inviterId: text("inviter_id")
      .notNull()
      .$type<UserId>()
      .references(() => user.id, { onDelete: "restrict" }),
    status: text("status", {
      enum: ["pending", "accepted", "rejected", "canceled", "expired"],
    })
      .notNull()
      .default("pending")
      .$type<InvitationStatus>(),
    expiresAt: createTimestampField("expires_at").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("invitation_pending_email_uidx")
      .on(table.organizationId, table.email)
      .where(sql`${table.status} = 'pending'`),
    foreignKey({
      name: "invitation_role_organization_fk",
      columns: [table.organizationRoleId, table.organizationId],
      foreignColumns: [organizationRole.id, organizationRole.organizationId],
    }).onDelete("restrict"),
    index("invitation_email_status_idx").on(table.email, table.status),
    index("invitation_organization_status_idx").on(table.organizationId, table.status),
    index("invitation_organization_role_idx").on(table.organizationRoleId, table.organizationId),
    index("invitation_expires_at_idx").on(table.expiresAt),
    check("invitation_email_normalized_check", sql`${table.email} = lower(btrim(${table.email}))`),
  ],
);
