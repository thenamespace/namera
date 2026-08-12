import { Schema, Struct } from "effect";

import { Email, UserId } from "#/common/index";
import { MetadataLogo, MetadataName, TimestampFields } from "#/model/common";
import { createUpdateSchema } from "#/model/helpers";

export const UserMetadata = Schema.Struct({
  version: Schema.Literal(1),
  name: Schema.optionalKey(MetadataName),
  image: Schema.optionalKey(MetadataLogo),
});

export const User = Schema.Struct({
  id: UserId,
  email: Email,
  emailVerified: Schema.Boolean,
  metadata: UserMetadata,
  lastLoginAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
}).mapFields(Struct.assign(TimestampFields));

export const UserUpdate = createUpdateSchema(User);
export const UserInsert = User.mapFields(Struct.pick(["email", "metadata"]));

export type UserMetadata = typeof UserMetadata.Type;

export type User = typeof User.Type;
export type UserUpdate = typeof UserUpdate.Type;
export type UserInsert = typeof UserInsert.Type;
