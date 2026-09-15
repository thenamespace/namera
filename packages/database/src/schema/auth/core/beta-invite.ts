import type { Email, UserId } from "@namera-ai/protocol";
import { sql } from "drizzle-orm";
import { check, text, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId } from "#/schema/common";

import { authSchema } from "../common.js";
import { user } from "./user.js";

export const betaInvite = authSchema.table(
  "beta_invite",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId),
    codeHmac: text("code_hmac").notNull(),
    email: text("email").$type<Email>(),
    createdAt: createTimestampField("created_at").notNull().defaultNow(),
    expiresAt: createTimestampField("expires_at").notNull(),
    redeemedAt: createTimestampField("redeemed_at"),
    redeemedBy: text("redeemed_by")
      .$type<UserId>()
      .references(() => user.id),
    revokedAt: createTimestampField("revoked_at"),
  },
  (table) => [
    uniqueIndex("beta_invite_code_hmac_uidx").on(table.codeHmac),
    check(
      "beta_invite_redemption_check",
      sql`(${table.redeemedAt} IS NULL) = (${table.redeemedBy} IS NULL)`,
    ),
    check(
      "beta_invite_terminal_check",
      sql`${table.redeemedAt} IS NULL OR ${table.revokedAt} IS NULL`,
    ),
    check("beta_invite_expiry_check", sql`${table.expiresAt} > ${table.createdAt}`),
  ],
);
