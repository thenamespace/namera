import type { Email, UserId, UserMetadata } from "@namera-ai/schema";

import { sql } from "drizzle-orm";
import { boolean, json, text, uniqueIndex } from "drizzle-orm/pg-core";

import {
  adminRole,
  createTimestampField,
  generateUniqueId,
  timestamps,
  userRole,
} from "../common";
import { onlyUserId, PgPolicyBuilder } from "../policy";
import { authSchema } from "./common";

// User Table
// Represents a unique user in Namera
// "insert" and "delete" policies are not needed as user cannot delete themselves or create new users
export const user = authSchema.table.withRLS(
  "user",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<UserId>(),
    name: text("name").notNull(),
    email: text("email").notNull().$type<Email>(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    metadata: json("metadata")
      .notNull()
      .$type<UserMetadata>()
      .default(sql`{}`),
    lastLoginAt: createTimestampField("last_login_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("user_email_uidx").on(table.email),
    // Users can only select themselves
    new PgPolicyBuilder()
      .name("user_select")
      .as("permissive")
      .to(userRole)
      .forOperation("select")
      .using(onlyUserId(table.id))
      .build(),
    // Users can only update themselves
    new PgPolicyBuilder()
      .name("user_update")
      .as("permissive")
      .to(userRole)
      .forOperation("update")
      .using(onlyUserId(table.id))
      .withCheck(onlyUserId(table.id))
      .build(),
    // Admins can access all users
    new PgPolicyBuilder()
      .name("user_adminaccess")
      .as("permissive")
      .to(adminRole)
      .forOperation("all")
      .using(sql`true`)
      .build(),
  ],
);
