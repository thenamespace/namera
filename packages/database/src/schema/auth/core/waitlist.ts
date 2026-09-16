import type { Email } from "@namera-ai/protocol";
import type { WaitlistStatus } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, index, text, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId, timestamps } from "#/schema/common";

import { authSchema } from "../common.js";

export const waitlist = authSchema.table(
  "waitlist",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId),
    email: text("email").notNull().$type<Email>(),
    status: text("status").notNull().$type<WaitlistStatus>().default("pending"),
    ...timestamps,
    completedAt: createTimestampField("completed_at"),
  },
  (table) => [
    uniqueIndex("waitlist_email_uidx").on(table.email),
    index("waitlist_status_id_idx").on(table.status, table.id),
    check("waitlist_email_normalized_check", sql`${table.email} = lower(btrim(${table.email}))`),
    check("waitlist_status_check", sql`${table.status} in ('pending', 'completed')`),
    check(
      "waitlist_completed_check",
      sql`(${table.status} = 'completed') = (${table.completedAt} IS NOT NULL)`,
    ),
  ],
);
