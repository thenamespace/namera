import type { EmailJobId } from "@namera-ai/protocol";
import type { EmailJob } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, index, integer, text, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId, timestamps } from "#/schema/common";

import { jobsSchema } from "./common.js";

export const emailJob = jobsSchema.table(
  "email_jobs",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<EmailJobId>(),
    type: text("type").notNull().$type<EmailJob["type"]>(),
    idempotencyKey: text("idempotency_key").notNull(),
    encryptedPayload: text("encrypted_payload"),
    status: text("status").notNull().default("pending").$type<EmailJob["status"]>(),
    attempts: integer("attempts").notNull().default(0),
    availableAt: createTimestampField("available_at").notNull().defaultNow(),
    expiresAt: createTimestampField("expires_at").notNull(),
    leaseToken: text("lease_token"),
    leaseExpiresAt: createTimestampField("lease_expires_at"),
    providerMessageId: text("provider_message_id"),
    sentAt: createTimestampField("sent_at"),
    lastErrorCode: text("last_error_code").$type<NonNullable<EmailJob["lastErrorCode"]>>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("email_jobs_idempotency_key_uidx").on(table.idempotencyKey),
    index("email_jobs_status_available_at_idx").on(table.status, table.availableAt),
    index("email_jobs_lease_expires_at_idx").on(table.leaseExpiresAt),
    index("email_jobs_expires_at_idx").on(table.expiresAt),
    check("email_jobs_attempts_nonnegative_check", sql`${table.attempts} >= 0`),
  ],
);
