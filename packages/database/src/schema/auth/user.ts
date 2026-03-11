import type { UserId } from "@namera-ai/schema";
import { sql } from "drizzle-orm";
import { boolean, pgPolicy, text } from "drizzle-orm/pg-core";

import { adminRole, generateUniqueId, timestamps, userRole } from "../common";
import { authSchema } from "./common";

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
    pgPolicy("user_self_select", {
      as: "permissive",
      to: userRole,
      for: "select",
      using: sql`${table.id} = auth_user_id()`,
    }),
    pgPolicy("user_self_update", {
      as: "permissive",
      to: userRole,
      for: "update",
      using: sql`${table.id} = auth_user_id()`,
      withCheck: sql`${table.id} = auth_user_id()`,
    }),
    pgPolicy("user_admin_access", {
      as: "permissive",
      to: adminRole,
      for: "all",
      using: sql`true`,
    }),
  ],
);
