import type { Email, UserId } from "@namera-ai/protocol";
import type { UserMetadata } from "@namera-ai/protocol/model";
import { text, boolean, jsonb, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId, lower, timestamps } from "#/schema/common";

import { authSchema } from "../common.js";

export const user = authSchema.table(
  "user",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<UserId>(),
    email: text("email").notNull().$type<Email>(),
    emailVerified: boolean("email_verified").notNull().default(false),
    metadata: jsonb("metadata").notNull().$type<UserMetadata>(),
    lastLoginAt: createTimestampField("last_login_at"),
    ...timestamps,
  },
  (table) => [uniqueIndex("user_email_uidx").on(lower(table.email))],
);
