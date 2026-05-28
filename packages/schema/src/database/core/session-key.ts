import { Schema, Struct } from "effect";

import {
  EthereumAddress,
  OrganizationId,
  OrganizationMemberId,
  SessionKeyId,
  SmartAccountId,
  SupportedChain,
} from "../../common";
import {
  MetadataDescription,
  MetadataLogo,
  MetadataName,
  TimestampFields,
} from "../common";
import { createInsertSchema, createUpdateSchema } from "../helpers";

export const SerializedAccount = Schema.Struct({
  chain: SupportedChain,
  serializedAccount: Schema.String,
});

export const SessionKeyMetadata = Schema.Struct({
  logo: MetadataLogo,
  name: MetadataName,
  description: MetadataDescription,
});

const BaseSessionKey = Schema.Struct({
  id: SessionKeyId,
  creatorId: OrganizationMemberId, // Reference to creator of session key
  organizationId: OrganizationId, // Reference to Organization
  smartAccountId: SmartAccountId, // Reference to smart account
  metadata: SessionKeyMetadata,
  serializedAccounts: Schema.Array(SerializedAccount),
}).mapFields(Struct.assign(TimestampFields));

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
  "creatorId",
  "organizationId",
  "smartAccountId",
  "metadata",
  "serializedAccounts",
  "type",
  "data",
);

export type SessionKeyData = typeof SessionKeyData.Type;
export type SerializedAccount = typeof SerializedAccount.Type;
export type SessionKeyMetadata = typeof SessionKeyMetadata.Type;
export type SessionKey = typeof SessionKey.Type;
export type SessionKeyUpdate = typeof SessionKeyUpdate.Type;
export type SessionKeyInsert = typeof SessionKeyInsert.Type;
