import { Schema, Struct } from "effect";

import { OrganizationId, SigningKeyId } from "#/common/index";
import { Hex } from "#/evm/index";
import { TimestampFields } from "#/model/common";

export const SigningKeyPurpose = Schema.Literals(["wallet-root", "session"]);
export const SigningKeyCustody = Schema.Literals(["local", "namera-managed"]);
export const SigningKeyAlgorithm = Schema.Literals(["p256", "secp256k1", "ed25519"]);
export const SigningKeyStatus = Schema.Literals(["active", "disabled", "destroyed"]);

export const PasskeyTransport = Schema.Literals(["ble", "hybrid", "internal", "nfc", "usb"]);

export const PasskeySigningKeyData = Schema.Struct({
  version: Schema.Literal(1),
  type: Schema.Literal("passkey"),
  credentialId: Schema.NonEmptyString,
  rpId: Schema.NonEmptyString,
  transports: Schema.Array(PasskeyTransport),
  signCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

export const LocalSigningKeyData = Schema.Struct({
  version: Schema.Literal(1),
  type: Schema.Literal("local-key"),
});

export const GcpSigningKeyProviderAlgorithm = Schema.Literals([
  "EC_SIGN_P256_SHA256",
  "EC_SIGN_ED25519",
  "EC_SIGN_SECP256K1_SHA256",
]);

export const GcpSigningKeyData = Schema.Struct({
  version: Schema.Literal(1),
  type: Schema.Literal("gcp-kms"),
  protectionLevel: Schema.Literals(["software", "hsm"]),
  providerAlgorithm: GcpSigningKeyProviderAlgorithm,
  keyVersionName: Schema.NonEmptyString,
});

export const ManagedLocalSigningKeyData = Schema.Struct({
  version: Schema.Literal(1),
  type: Schema.Literal("local-provider"),
  protectionLevel: Schema.Literals(["software", "hsm"]),
  fileName: Schema.NonEmptyString,
});

export const SigningKeyData = Schema.Union([
  PasskeySigningKeyData,
  LocalSigningKeyData,
  GcpSigningKeyData,
  ManagedLocalSigningKeyData,
]);

const SigningKeyFields = {
  id: SigningKeyId,
  organizationId: OrganizationId,
  publicKeyHex: Hex,
  status: SigningKeyStatus,
};

const LocalPasskeySigningKey = Schema.Struct({
  ...SigningKeyFields,
  purpose: Schema.Literal("wallet-root"),
  custody: Schema.Literal("local"),
  algorithm: Schema.Literal("p256"),
  data: PasskeySigningKeyData,
}).mapFields(Struct.assign(TimestampFields));

const LocalSigningKey = Schema.Struct({
  ...SigningKeyFields,
  purpose: SigningKeyPurpose,
  custody: Schema.Literal("local"),
  algorithm: SigningKeyAlgorithm,
  data: LocalSigningKeyData,
}).mapFields(Struct.assign(TimestampFields));

const NameraManagedSigningKey = Schema.Struct({
  ...SigningKeyFields,
  purpose: SigningKeyPurpose,
  custody: Schema.Literal("namera-managed"),
  algorithm: SigningKeyAlgorithm,
  data: Schema.Union([GcpSigningKeyData, ManagedLocalSigningKeyData]),
}).mapFields(Struct.assign(TimestampFields));

export const SigningKey = Schema.Union([
  LocalPasskeySigningKey,
  LocalSigningKey,
  NameraManagedSigningKey,
]);

const SigningKeyInsertFields = {
  id: SigningKeyId,
  organizationId: OrganizationId,
  publicKeyHex: Hex,
  status: SigningKeyStatus,
};

export const SigningKeyInsert = Schema.Union([
  Schema.Struct({
    ...SigningKeyInsertFields,
    purpose: Schema.Literal("wallet-root"),
    custody: Schema.Literal("local"),
    algorithm: Schema.Literal("p256"),
    data: PasskeySigningKeyData,
  }),
  Schema.Struct({
    ...SigningKeyInsertFields,
    purpose: SigningKeyPurpose,
    custody: Schema.Literal("local"),
    algorithm: SigningKeyAlgorithm,
    data: LocalSigningKeyData,
  }),
  Schema.Struct({
    ...SigningKeyInsertFields,
    purpose: SigningKeyPurpose,
    custody: Schema.Literal("namera-managed"),
    algorithm: SigningKeyAlgorithm,
    data: Schema.Union([GcpSigningKeyData, ManagedLocalSigningKeyData]),
  }),
]);

export type SigningKeyPurpose = typeof SigningKeyPurpose.Type;
export type SigningKeyCustody = typeof SigningKeyCustody.Type;
export type SigningKeyAlgorithm = typeof SigningKeyAlgorithm.Type;
export type SigningKeyStatus = typeof SigningKeyStatus.Type;
export type PasskeyTransport = typeof PasskeyTransport.Type;
export type PasskeySigningKeyData = typeof PasskeySigningKeyData.Type;
export type LocalSigningKeyData = typeof LocalSigningKeyData.Type;
export type GcpSigningKeyProviderAlgorithm = typeof GcpSigningKeyProviderAlgorithm.Type;
export type GcpSigningKeyData = typeof GcpSigningKeyData.Type;
export type ManagedLocalSigningKeyData = typeof ManagedLocalSigningKeyData.Type;
export type SigningKeyData = typeof SigningKeyData.Type;
export type SigningKey = typeof SigningKey.Type;
export type SigningKeyEncoded = typeof SigningKey.Encoded;
export type SigningKeyInsert = typeof SigningKeyInsert.Type;
