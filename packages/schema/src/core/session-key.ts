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

export const SessionKeyMetadata = Schema.Struct({
  icon: Schema.Struct({
    type: Schema.Literals(["icon", "emoji"]),
    value: Schema.String,
  }),
  name: Schema.String.check(
    Schema.isLengthBetween(4, 255, {
      message: "Name must be between 4 and 255 characters long",
    }),
  ),
  description: Schema.optional(Schema.String),
});

const BaseSessionKey = Schema.Struct({
  id: SessionKeyId,
  userId: UserId, // Reference to user
  smartAccountId: SmartAccountId, // Reference to smart account
  serializedAccounts: Schema.Array(SerializedAccount),
  metadata: SessionKeyMetadata,
  // Timestamps
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
  "metadata",
  "smartAccountId",
  "serializedAccounts",
);

export type SessionKey = typeof SessionKey.Type;
export type SessionKeyUpdate = typeof SessionKeyUpdate.Type;
export type SessionKeyInsert = typeof SessionKeyInsert.Type;
export type SessionKeyData = typeof SessionKeyData.Type;
export type SerializedAccount = typeof SerializedAccount.Type;
