import type { Email, UserId } from "@namera-ai/protocol";
import type { UserMetadata } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { boolean, check, jsonb, text } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId, timestamps } from "#/schema/common";

import { authSchema } from "../common.js";

export const user = authSchema.table(
  "user",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<UserId>(),
    email: text("email").notNull().unique("user_email_unique").$type<Email>(),
    emailVerified: boolean("email_verified").notNull().default(false),
    metadata: jsonb("metadata").notNull().$type<UserMetadata>(),
    lastLoginAt: createTimestampField("last_login_at"),
    ...timestamps,
  },
  (table) => [
    check("user_email_normalized_check", sql`${table.email} = lower(btrim(${table.email}))`),
  ],
);
