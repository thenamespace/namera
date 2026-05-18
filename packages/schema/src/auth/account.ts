import { Schema } from "effect";

import { createInsertSchema, createUpdateSchema } from "@/helpers";

import { AccountId, UserId } from "../common";

export const Account = Schema.Struct({
  id: AccountId,
  userId: UserId,
  accountId: Schema.String,
  accessToken: Schema.NullOr(Schema.String),
  idToken: Schema.NullOr(Schema.String),
  password: Schema.NullOr(Schema.String),
  providerId: Schema.String,
  refreshToken: Schema.NullOr(Schema.String),
  scope: Schema.NullOr(Schema.String),
  accessTokenExpiresAt: Schema.NullOr(Schema.Date),
  refreshTokenExpiresAt: Schema.NullOr(Schema.Date),
  lastUsedAt: Schema.NullOr(Schema.Date),
  deletedAt: Schema.NullOr(Schema.Date),
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
});

export const AccountUpdate = createUpdateSchema(Account);
export const AccountInsert = createInsertSchema(
  Account,
  "userId",
  "accountId",
  "providerId",
);

export type Account = typeof Account.Type;
export type AccountUpdate = typeof AccountUpdate.Type;
export type AccountInsert = typeof AccountInsert.Type;
