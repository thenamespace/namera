import { Schema } from "effect";

import { EthereumAddress, UserId } from "../../common";

export const SessionKey = Schema.Struct({
  id: Schema.String,
  userId: UserId,
  name: Schema.optional(Schema.String),
  address: EthereumAddress,
  smartAccountId: Schema.String,
  serializedAccount: Schema.String,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
});

export type SessionKey = typeof SessionKey.Type;
