import { Schema, Struct } from "effect";

import { Email, UserId } from "../../common";
import { TimestampFields, MetadataName } from "../common";
import { createUpdateSchema, createInsertSchema } from "../helpers";

export const UserMetadata = Schema.Struct({
  name: MetadataName,
  image: Schema.optional(Schema.String),
});

export const User = Schema.Struct({
  id: UserId,
  email: Email,
  emailVerified: Schema.Boolean,
  metadata: UserMetadata,
  lastLoginAt: Schema.DateTimeUtcFromDate,
}).mapFields(Struct.assign(TimestampFields));

export const UserUpdate = createUpdateSchema(User);
export const UserInsert = createInsertSchema(
  User,
  "email",
  "emailVerified",
  "metadata",
  "lastLoginAt",
);

export type UserMetadata = typeof UserMetadata.Type;

export type User = typeof User.Type;
export type UserUpdate = typeof UserUpdate.Type;
export type UserInsert = typeof UserInsert.Type;
