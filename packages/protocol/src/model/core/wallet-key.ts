import { Schema, Struct } from "effect";

import { OrganizationId, SigningKeyId, WalletKeyId } from "#/common/index";
import { Hex } from "#/evm/index";
import { TimestampFields } from "#/model/common";
import { createInsertSchema, createUpdateSchema } from "#/model/helpers";

export const WalletKeyAlgorithm = Schema.Literals(["p256", "secp256k1", "ed25519"]);
export const WalletKeyProtectionLevel = Schema.Literals(["software", "hsm"]);
export const WalletKeyStatus = Schema.Literals(["active", "disabled", "destroyed"]);
export const WalletKeyProvider = Schema.Literals(["gcp-kms", "local"]);
export const LocalWalletKeyData = Schema.Struct({
  version: Schema.Literal(1),
  fileName: Schema.NonEmptyString,
});
export const GcpWalletKeyProviderAlgorithm = Schema.Literals([
  "EC_SIGN_P256_SHA256",
  "EC_SIGN_ED25519",
  "EC_SIGN_SECP256K1_SHA256",
]);
export const GcpWalletKeyData = Schema.Struct({
  version: Schema.Literal(1),
  providerAlgorithm: GcpWalletKeyProviderAlgorithm,
  keyVersionName: Schema.NonEmptyString,
});
export const WalletKeyData = Schema.Union([LocalWalletKeyData, GcpWalletKeyData]);

export const CreateWalletKeyInput = Schema.Union([
  Schema.Struct({
    id: SigningKeyId,
    algorithm: Schema.Literals(["p256", "ed25519"]),
    protectionLevel: WalletKeyProtectionLevel,
  }),
  Schema.Struct({
    id: SigningKeyId,
    algorithm: Schema.Literal("secp256k1"),
    protectionLevel: Schema.Literal("hsm"),
  }),
]);

export const CreatedWalletKey = Schema.Union([
  Schema.Struct({
    provider: Schema.Literal("local"),
    algorithm: WalletKeyAlgorithm,
    protectionLevel: WalletKeyProtectionLevel,
    publicKeyHex: Hex,
    data: LocalWalletKeyData,
  }),
  Schema.Struct({
    provider: Schema.Literal("gcp-kms"),
    algorithm: WalletKeyAlgorithm,
    protectionLevel: WalletKeyProtectionLevel,
    publicKeyHex: Hex,
    data: GcpWalletKeyData,
  }),
]);

export const WalletKeyHash = Schema.Uint8Array.check(
  Schema.isLengthBetween(32, 32, { message: "Wallet key hashes must be 32 bytes" }),
);

export const SignWalletKeyMessageInput = Schema.Union([
  Schema.Struct({
    provider: Schema.Literal("local"),
    algorithm: WalletKeyAlgorithm,
    data: LocalWalletKeyData,
    message: Schema.Uint8Array,
  }),
  Schema.Struct({
    provider: Schema.Literal("gcp-kms"),
    algorithm: WalletKeyAlgorithm,
    data: GcpWalletKeyData,
    message: Schema.Uint8Array,
  }),
]);

export const SignWalletKeyHashInput = Schema.Union([
  Schema.Struct({
    provider: Schema.Literal("local"),
    algorithm: Schema.Literals(["p256", "secp256k1"]),
    data: LocalWalletKeyData,
    hash: WalletKeyHash,
  }),
  Schema.Struct({
    provider: Schema.Literal("gcp-kms"),
    algorithm: Schema.Literals(["p256", "secp256k1"]),
    data: GcpWalletKeyData,
    hash: WalletKeyHash,
  }),
]);

export const DisableWalletKeyInput = Schema.Union([
  Schema.Struct({ provider: Schema.Literal("local"), data: LocalWalletKeyData }),
  Schema.Struct({ provider: Schema.Literal("gcp-kms"), data: GcpWalletKeyData }),
]);

export const DestroyWalletKeyInput = DisableWalletKeyInput;

export const WalletKey = Schema.Struct({
  id: WalletKeyId,
  organizationId: OrganizationId,
  provider: WalletKeyProvider,
  algorithm: WalletKeyAlgorithm,
  protectionLevel: WalletKeyProtectionLevel,
  publicKeyHex: Hex,
  status: WalletKeyStatus,
  data: WalletKeyData,
}).mapFields(Struct.assign(TimestampFields));

export const WalletKeyUpdate = createUpdateSchema(WalletKey);
export const WalletKeyInsert = createInsertSchema(
  WalletKey,
  "id",
  "organizationId",
  "provider",
  "algorithm",
  "protectionLevel",
  "publicKeyHex",
  "status",
  "data",
);

export type LocalWalletKeyData = typeof LocalWalletKeyData.Type;
export type GcpWalletKeyProviderAlgorithm = typeof GcpWalletKeyProviderAlgorithm.Type;
export type GcpWalletKeyData = typeof GcpWalletKeyData.Type;
export type CreateWalletKeyInput = typeof CreateWalletKeyInput.Type;
export type CreatedWalletKey = typeof CreatedWalletKey.Type;
export type WalletKeyHash = typeof WalletKeyHash.Type;
export type SignWalletKeyMessageInput = typeof SignWalletKeyMessageInput.Type;
export type SignWalletKeyHashInput = typeof SignWalletKeyHashInput.Type;
export type DisableWalletKeyInput = typeof DisableWalletKeyInput.Type;
export type DestroyWalletKeyInput = typeof DestroyWalletKeyInput.Type;
export type WalletKey = typeof WalletKey.Type;
export type WalletKeyAlgorithm = typeof WalletKeyAlgorithm.Type;
export type WalletKeyProtectionLevel = typeof WalletKeyProtectionLevel.Type;
export type WalletKeyProvider = typeof WalletKeyProvider.Type;
export type WalletKeyStatus = typeof WalletKeyStatus.Type;
export type WalletKeyUpdate = typeof WalletKeyUpdate.Type;
export type WalletKeyInsert = typeof WalletKeyInsert.Type;
