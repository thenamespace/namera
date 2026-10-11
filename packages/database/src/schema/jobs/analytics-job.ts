import type { ProductMilestone } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { index, integer, jsonb, text, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId } from "#/schema/common";

import { jobsSchema } from "./common.js";

export const analyticsJob = jobsSchema.table(
  "analytics_jobs",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId),
    dedupeKey: text("dedupe_key").notNull(),
    payload: jsonb("payload").$type<ProductMilestone>(),
    createdAt: createTimestampField("created_at").notNull().defaultNow(),
    availableAt: createTimestampField("available_at").notNull().defaultNow(),
    deliveredAt: createTimestampField("delivered_at"),
    attempts: integer("attempts").notNull().default(0),
    leaseToken: text("lease_token"),
  },
  (table) => [
    uniqueIndex("analytics_jobs_dedupe_key_uidx").on(table.dedupeKey),
    index("analytics_jobs_available_at_idx")
      .on(table.availableAt)
      .where(sql`${table.deliveredAt} IS NULL`),
  ],
);
