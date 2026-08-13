import type { BillingProviderEventId } from "@namera-ai/protocol";
import type { BillingProviderEvent, BillingProviderEventEncoded } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, text, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId, timestamps } from "#/schema/common";

import { billingSchema } from "./common.js";

export const billingProviderEvent = billingSchema.table(
  "provider_event",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<BillingProviderEventId>(),
    provider: text("provider").notNull().$type<BillingProviderEvent["provider"]>(),
    providerEventId: text("provider_event_id").notNull(),
    type: text("type").notNull(),
    livemode: boolean("livemode").notNull(),
    data: jsonb("data").notNull().$type<BillingProviderEventEncoded["data"]>(),
    status: text("status").notNull().default("pending").$type<BillingProviderEvent["status"]>(),
    attempts: integer("attempts").notNull().default(0),
    providerCreatedAt: createTimestampField("provider_created_at").notNull(),
    processedAt: createTimestampField("processed_at"),
    lastError: text("last_error"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("billing_provider_event_provider_id_uidx").on(
      table.provider,
      table.providerEventId,
    ),
    index("billing_provider_event_status_created_at_idx").on(table.status, table.createdAt),
    check("billing_provider_event_attempts_check", sql`${table.attempts} >= 0`),
  ],
);
