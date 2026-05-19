import { Schema } from "effect";

import { createInsertSchema, createUpdateSchema } from "@/helpers";

import { Email, UserId } from "../common";

export const UserMetadata = Schema.Struct({});

export const User = Schema.Struct({
  id: UserId,
  name: Schema.String,
  email: Email,
  emailVerified: Schema.Boolean,
  image: Schema.NullOr(Schema.String),
  metadata: UserMetadata,
  lastLoginAt: Schema.Date,
  deletedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
});

export const UserUpdate = createUpdateSchema(User);
export const UserInsert = createInsertSchema(
  User,
  "name",
  "email",
  "emailVerified",
  "image",
  "lastLoginAt",
);

export type UserMetadata = typeof UserMetadata.Type;
export type User = typeof User.Type;
export type UserUpdate = typeof UserUpdate.Type;
export type UserInsert = typeof UserInsert.Type;
