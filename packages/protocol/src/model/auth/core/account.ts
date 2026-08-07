import { Schema, Struct } from "effect";

import { AccountId, UserId } from "#/common/index";
import { NonEmptyString, TimestampFields } from "#/model/common";
import { createInsertSchema, createUpdateSchema } from "#/model/helpers";

export const Account = Schema.Struct({
  id: AccountId,
  userId: UserId,
  accountId: NonEmptyString,
  providerId: NonEmptyString,
  accessToken: Schema.NullOr(Schema.String),
  idToken: Schema.NullOr(Schema.String),
  refreshToken: Schema.NullOr(Schema.String),
  password: Schema.NullOr(Schema.String),
  scope: Schema.NullOr(Schema.String),
  accessTokenExpiresAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  refreshTokenExpiresAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  lastUsedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
}).mapFields(Struct.assign(TimestampFields));

export const AccountUpdate = createUpdateSchema(Account);
export const AccountInsert = createInsertSchema(Account, "userId", "accountId", "providerId");

export type Account = typeof Account.Type;
export type AccountUpdate = typeof AccountUpdate.Type;
export type AccountInsert = typeof AccountInsert.Type;
