import { Schema } from "effect";

import { createInsertSchema, createUpdateSchema, UserId } from "../common";

export const Account = Schema.Struct({
  id: Schema.String,
  accountId: Schema.String,
  accessToken: Schema.NullOr(Schema.String),
  accessTokenExpiresAt: Schema.Date,
  idToken: Schema.NullOr(Schema.String),
  password: Schema.NullOr(Schema.String),
  providerId: Schema.String,
  refreshToken: Schema.NullOr(Schema.String),
  refreshTokenExpiresAt: Schema.Date,
  scope: Schema.NullOr(Schema.String),
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
  userId: UserId,
});

export const AccountUpdate = createUpdateSchema(Account);
export const AccountInsert = createInsertSchema(
  Account,
  "id",
  "accountId",
  "providerId",
  "userId",
);

export type Account = typeof Account.Type;
export type AccountUpdate = typeof AccountUpdate.Type;
export type AccountInsert = typeof AccountInsert.Type;
