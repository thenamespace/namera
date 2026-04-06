import { Schema } from "effect";

import { createInsertSchema, createUpdateSchema } from "@/helpers";

import { EthereumAddress, SessionKeyId, SmartAccountId, SupportedChain, UserId } from "../common";

// TODO: update this...
export const SessionKey = Schema.Struct({
  id: SessionKeyId,
  userId: UserId,
  name: Schema.optional(Schema.String),
  address: EthereumAddress,
  smartAccountId: SmartAccountId, // Reference to smart account
  serializedAccount: Schema.String,
  encSessionPrivateKey: Schema.String,
  chain: SupportedChain,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
});

export const SessionKeyUpdate = createUpdateSchema(SessionKey);
export const SessionKeyInsert = createInsertSchema(
  SessionKey,
  "userId",
  "name",
  "address",
  "smartAccountId",
  "serializedAccount",
  "encSessionPrivateKey",
  "chain",
);
