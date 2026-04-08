import { Schema, Struct } from "effect";

import { createInsertSchema, createUpdateSchema } from "@/helpers";

import {
  EthereumAddress,
  SessionKeyId,
  SmartAccountId,
  SupportedChain,
  UserId,
} from "../common";

export const SerializedAccount = Schema.Struct({
  chain: SupportedChain,
  serializedAccount: Schema.String,
});

const BaseSessionKey = Schema.Struct({
  id: SessionKeyId,
  userId: UserId,
  name: Schema.optional(Schema.String),
  smartAccountId: SmartAccountId, // Reference to smart account
  serializedAccounts: Schema.Array(SerializedAccount),
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
});

const EcdsaSessionKeyData = Schema.Struct({
  address: EthereumAddress,
  encPrivateKey: Schema.String,
});

export const SessionKeyData = Schema.Union([EcdsaSessionKeyData]);

const EcdsaSessionKey = BaseSessionKey.mapFields(
  Struct.assign({
    type: Schema.Literal("ecdsa"),
    data: EcdsaSessionKeyData,
  }),
);

export const SessionKey = Schema.Union([EcdsaSessionKey]);

export const SessionKeyUpdate = createUpdateSchema(SessionKey);
export const SessionKeyInsert = createInsertSchema(
  SessionKey,
  "type",
  "userId",
  "name",
  "smartAccountId",
  "serializedAccounts",
);

export type SessionKey = typeof SessionKey.Type;
export type SessionKeyUpdate = typeof SessionKeyUpdate.Type;
export type SessionKeyInsert = typeof SessionKeyInsert.Type;
export type SessionKeyData = typeof SessionKeyData.Type;
export type SerializedAccount = typeof SerializedAccount.Type;
