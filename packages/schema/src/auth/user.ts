import { Schema } from "effect";

import { createInsertSchema, createUpdateSchema } from "@/helpers";

import { Email, UserId } from "../common";

export const User = Schema.Struct({
  id: UserId,
  name: Schema.String,
  email: Email,
  emailVerified: Schema.Boolean,
  image: Schema.NullOr(Schema.String),
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
});

export const UserUpdate = createUpdateSchema(User);
export const UserInsert = createInsertSchema(User, "name", "email");

export type User = typeof User.Type;
export type UserUpdate = typeof UserUpdate.Type;
export type UserInsert = typeof UserInsert.Type;
