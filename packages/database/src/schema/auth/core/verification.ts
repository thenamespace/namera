import type { VerificationId } from "@namera-ai/protocol";
import type { VerificationData, VerificationPurpose } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, text, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId, timestamps } from "#/schema/common";

import { authSchema } from "../common.js";

export const verification = authSchema.table(
  "verification",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<VerificationId>(),
    purpose: text("purpose").notNull().$type<VerificationPurpose>(),
    identifier: text("identifier").notNull(),
    data: jsonb("data").notNull().$type<VerificationData>(),
    tokenHash: text("token_hash"),
    codeHmac: text("code_hmac"),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: createTimestampField("expires_at").notNull(),
    consumedAt: createTimestampField("consumed_at"),
    revokedAt: createTimestampField("revoked_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("verification_token_hash_uidx").on(table.tokenHash),
    uniqueIndex("verification_pending_identifier_uidx")
      .on(table.purpose, table.identifier)
      .where(sql`${table.consumedAt} IS NULL AND ${table.revokedAt} IS NULL`),
    index("verification_purpose_identifier_idx").on(table.purpose, table.identifier),
    index("verification_expires_at_idx").on(table.expiresAt),
    check(
      "verification_identifier_normalized_check",
      sql`${table.identifier} = lower(btrim(${table.identifier}))`,
    ),
    check(
      "verification_purpose_fields_check",
      sql`(
        ${table.purpose} = 'magic-link-signin'
        AND ${table.tokenHash} IS NOT NULL
        AND ${table.codeHmac} IS NOT NULL
      ) OR (
        ${table.purpose} = 'beta-admission'
        AND ${table.tokenHash} IS NOT NULL
        AND ${table.codeHmac} IS NULL
      ) OR (
        ${table.purpose} = 'passkey-registration'
        AND ${table.tokenHash} IS NULL
        AND ${table.codeHmac} IS NULL
      )`,
    ),
    check("verification_attempts_nonnegative_check", sql`${table.attempts} >= 0`),
  ],
);
