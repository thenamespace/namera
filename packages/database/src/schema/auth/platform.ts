import type { Email, UserId } from "@namera-ai/protocol";
import type { PlatformMember, PlatformInvitation } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, index, text, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId } from "#/schema/common";

import { authSchema } from "./common.js";
import { user } from "./core/user.js";

export const platformMember = authSchema.table(
  "platform_member",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId),
    userId: text("user_id")
      .$type<UserId>()
      .notNull()
      .references(() => user.id),
    role: text("role").$type<PlatformMember["role"]>().notNull(),
    status: text("status").$type<PlatformMember["status"]>().notNull().default("active"),
    createdAt: createTimestampField("created_at").notNull().defaultNow(),
    updatedAt: createTimestampField("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("platform_member_user_uidx").on(t.userId),
    uniqueIndex("platform_member_owner_uidx")
      .on(t.role)
      .where(sql`${t.role} = 'owner'`),
    check("platform_member_role_check", sql`${t.role} in ('owner', 'operator', 'viewer')`),
    check("platform_member_status_check", sql`${t.status} in ('active', 'suspended', 'removed')`),
    check(
      "platform_member_owner_active_check",
      sql`${t.role} <> 'owner' or ${t.status} = 'active'`,
    ),
  ],
);

export const platformInvitation = authSchema.table(
  "platform_invitation",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId),
    email: text("email").$type<Email>().notNull(),
    role: text("role").$type<PlatformInvitation["role"]>().notNull(),
    tokenHash: text("token_hash").notNull(),
    invitedByMemberId: text("invited_by_member_id")
      .notNull()
      .references(() => platformMember.id),
    expiresAt: createTimestampField("expires_at").notNull(),
    acceptedAt: createTimestampField("accepted_at"),
    acceptedByUserId: text("accepted_by_user_id")
      .$type<UserId>()
      .references(() => user.id),
    revokedAt: createTimestampField("revoked_at"),
    createdAt: createTimestampField("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("platform_invitation_token_uidx").on(t.tokenHash),
    uniqueIndex("platform_invitation_pending_email_uidx")
      .on(t.email)
      .where(sql`${t.acceptedAt} is null and ${t.revokedAt} is null`),
    index("platform_invitation_inviter_idx").on(t.invitedByMemberId),
    check("platform_invitation_role_check", sql`${t.role} in ('operator', 'viewer')`),
    check("platform_invitation_email_check", sql`${t.email} = lower(trim(${t.email}))`),
    check(
      "platform_invitation_accepted_check",
      sql`(${t.acceptedAt} is null) = (${t.acceptedByUserId} is null)`,
    ),
    check(
      "platform_invitation_terminal_check",
      sql`${t.acceptedAt} is null or ${t.revokedAt} is null`,
    ),
    check("platform_invitation_expiry_check", sql`${t.expiresAt} > ${t.createdAt}`),
  ],
);
