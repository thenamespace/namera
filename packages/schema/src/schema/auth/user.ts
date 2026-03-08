import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-orm/effect-schema";
import { boolean, text } from "drizzle-orm/pg-core";
import { Schema } from "effect";

import { generateUniqueId, timestamps } from "../common";
import { authSchema } from "./common";

export const UserId = Schema.String.pipe(Schema.brand("UserId"));
export type UserId = typeof UserId.Type;

export const user = authSchema.table("user", {
  id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<UserId>(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  ...timestamps,
});

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
