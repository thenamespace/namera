import { sql } from "drizzle-orm";
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-orm/effect-schema";
import { boolean, pgPolicy, text } from "drizzle-orm/pg-core";
import { Schema } from "effect";

import { adminRole, generateUniqueId, timestamps, userRole } from "../common";
import { authSchema } from "./common";

export const UserId = Schema.String.pipe(Schema.brand("UserId"));
export type UserId = typeof UserId.Type;

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

export const UserSchema = createSelectSchema(user, {
  id: () => UserId,
});

export const UserInsertSchema = createInsertSchema(user, {
  id: () => Schema.UndefinedOr(UserId),
});

export const UserUpdateSchema = createUpdateSchema(user, {
  id: () => UserId,
});

export type User = typeof UserSchema.Type;
export type UserInsert = typeof UserInsertSchema.Type;
export type UserUpdate = typeof UserUpdateSchema.Type;
