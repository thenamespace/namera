import { Schema, Struct } from "effect";

import { Hex, OrganizationId, WalletKeyId } from "#/common/index";
import { TimestampFields } from "#/model/common";
import { createInsertSchema, createUpdateSchema } from "#/model/helpers";

export const WalletKeyAlgorithm = Schema.Literals(["p256", "secp256k1", "ed25519"]);
export const WalletKeyProtectionLevel = Schema.Literals(["software", "hsm"]);
export const WalletKeyStatus = Schema.Literals(["active", "disabled", "destroyed"]);
export const WalletKeyProvider = Schema.Literals(["gcp-kms", "local"]);
export const WalletKeyData = Schema.Union([
  Schema.Struct({
    version: Schema.Literal(1),
    providerAlgorithm: Schema.String,
    cryptoKeyName: Schema.String,
  }),
  Schema.Struct({
    version: Schema.Literal(1),
    fileName: Schema.NonEmptyString,
  }),
]);

export const WalletKey = Schema.Struct({
  id: WalletKeyId,
  organizationId: OrganizationId,
  provider: WalletKeyProvider,
  algorithm: WalletKeyAlgorithm,
  protectionLevel: WalletKeyProtectionLevel,
  keyVersionName: Schema.NonEmptyString,
  publicKeyHex: Hex,
  status: WalletKeyStatus,
  data: WalletKeyData,
}).mapFields(Struct.assign(TimestampFields));

export const WalletKeyUpdate = createUpdateSchema(WalletKey);
export const WalletKeyInsert = createInsertSchema(
  WalletKey,
  "organizationId",
  "provider",
  "algorithm",
  "protectionLevel",
  "keyVersionName",
  "publicKeyHex",
  "status",
  "data",
);

export type WalletKey = typeof WalletKey.Type;
export type WalletKeyUpdate = typeof WalletKeyUpdate.Type;
export type WalletKeyInsert = typeof WalletKeyInsert.Type;
