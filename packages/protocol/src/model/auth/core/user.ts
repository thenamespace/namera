import { Schema, Struct } from "effect";

import { Email, UserId } from "#/common/index";
import { MetadataName, TimestampFields } from "#/model/common";
import { createInsertSchema, createUpdateSchema } from "#/model/helpers";

export const UserMetadata = Schema.Struct({
  version: Schema.Literal(1),
  name: Schema.optionalKey(MetadataName),
  image: Schema.optionalKey(Schema.String),
});

export const User = Schema.Struct({
  id: UserId,
  email: Email,
  emailVerified: Schema.Boolean,
  metadata: UserMetadata,
  lastLoginAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
}).mapFields(Struct.assign(TimestampFields));

export const UserUpdate = createUpdateSchema(User);
export const UserInsert = createInsertSchema(User, "email");

export type UserMetadata = typeof UserMetadata.Type;

export type User = typeof User.Type;
export type UserUpdate = typeof UserUpdate.Type;
export type UserInsert = typeof UserInsert.Type;
