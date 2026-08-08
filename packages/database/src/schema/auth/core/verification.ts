import type { Email, VerificationId } from "@namera-ai/protocol";
import type { VerificationPurpose } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, index, integer, text, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId, timestamps } from "#/schema/common";

import { authSchema } from "../common.js";

export const verification = authSchema.table(
  "verification",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<VerificationId>(),
    purpose: text("purpose", { enum: ["magic-link-signin"] })
      .notNull()
      .$type<VerificationPurpose>(),
    identifier: text("identifier").notNull().$type<Email>(),
    tokenHash: text("token_hash").notNull(),
    codeHmac: text("code_hmac").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: createTimestampField("expires_at").notNull(),
    consumedAt: createTimestampField("consumed_at"),
    revokedAt: createTimestampField("revoked_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("verification_token_hash_uidx").on(table.tokenHash),
    index("verification_purpose_identifier_idx").on(table.purpose, table.identifier),
    index("verification_expires_at_idx").on(table.expiresAt),
    check(
      "verification_identifier_normalized_check",
      sql`${table.identifier} = lower(btrim(${table.identifier}))`,
    ),
    check("verification_attempts_nonnegative_check", sql`${table.attempts} >= 0`),
    check("verification_purpose_check", sql`${table.purpose} IN ('magic-link-signin')`),
  ],
);
