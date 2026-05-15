import type { UserId } from "@namera-ai/schema";

import { boolean, text } from "drizzle-orm/pg-core";

import { adminRole, generateUniqueId, timestamps, userRole } from "../common";
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
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    ...timestamps,
  },
  (table) => [
    // Users can only select themselves
    new PgPolicyBuilder()
      .name("user_self_select")
      .as("permissive")
      .to(userRole)
      .forOperation("select")
      .using(onlyUserId(table.id))
      .build(),
    // Users can only update themselves
    new PgPolicyBuilder()
      .name("user_self_update")
      .as("permissive")
      .to(userRole)
      .forOperation("update")
      .using(onlyUserId(table.id))
      .withCheck(onlyUserId(table.id))
      .build(),
    // Admins can access all users
    new PgPolicyBuilder()
      .name("user_admin_access")
      .as("permissive")
      .to(adminRole)
      .forOperation("all")
      .using("true")
      .build(),
  ],
);
