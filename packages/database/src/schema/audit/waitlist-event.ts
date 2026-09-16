import type { WaitlistStatus } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, index, text } from "drizzle-orm/pg-core";

import { waitlist } from "#/schema/auth/core/waitlist";
import { createTimestampField, generateUniqueId } from "#/schema/common";

import { auditSchema } from "./common.js";

export const waitlistEvent = auditSchema.table(
  "waitlist_events",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId),
    waitlistId: text("waitlist_id")
      .notNull()
      .references(() => waitlist.id),
    previousStatus: text("previous_status").notNull().$type<WaitlistStatus>(),
    status: text("status").notNull().$type<WaitlistStatus>(),
    createdAt: createTimestampField("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("waitlist_events_entry_idx").on(table.waitlistId),
    check(
      "waitlist_event_transition_check",
      sql`${table.previousStatus} in ('pending', 'completed') AND ${table.status} in ('pending', 'completed') AND ${table.previousStatus} <> ${table.status}`,
    ),
  ],
);
