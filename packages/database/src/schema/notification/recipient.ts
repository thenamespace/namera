import type { EmailJobId, NotificationId, UserId } from "@namera-ai/protocol";
import { sql } from "drizzle-orm";
import { index, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField } from "#/schema/common";

import { user } from "../auth/core/user.js";
import { emailJob } from "../jobs/email-job.js";
import { notificationSchema } from "./common.js";
import { notification } from "./notification.js";

export const notificationRecipient = notificationSchema.table(
  "notification_recipients",
  {
    notificationId: text("notification_id")
      .notNull()
      .$type<NotificationId>()
      .references(() => notification.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .$type<UserId>()
      .references(() => user.id, { onDelete: "restrict" }),
    emailJobId: text("email_job_id")
      .$type<EmailJobId>()
      .references(() => emailJob.id, { onDelete: "set null" }),
    readAt: createTimestampField("read_at"),
    archivedAt: createTimestampField("archived_at"),
    receivedAt: createTimestampField("received_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      name: "notification_recipients_pk",
      columns: [table.notificationId, table.userId],
    }),
    uniqueIndex("notification_recipients_email_job_uidx").on(table.emailJobId),
    index("notification_recipients_user_received_at_idx").on(table.userId, table.receivedAt.desc()),
    index("notification_recipients_user_unread_received_at_idx")
      .on(table.userId, table.receivedAt.desc())
      .where(sql`${table.readAt} IS NULL AND ${table.archivedAt} IS NULL`),
  ],
);
