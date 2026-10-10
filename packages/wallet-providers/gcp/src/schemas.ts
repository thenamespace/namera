import { Schema } from "effect";

import { Hex, SigningKeyId } from "@namera-ai/protocol";
import {
  GcpWalletKeyData,
  WalletKeyAlgorithm,
  WalletKeyProtectionLevel,
} from "@namera-ai/protocol/model";

export const CreateKeyInput = Schema.Union([
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

export const CreatedKey = Schema.Struct({
  algorithm: WalletKeyAlgorithm,
  protectionLevel: WalletKeyProtectionLevel,
  publicKeyHex: Hex,
  data: GcpWalletKeyData,
});

export const SignMessageInput = Schema.Struct({
  algorithm: WalletKeyAlgorithm,
  data: GcpWalletKeyData,
  message: Schema.Uint8Array,
});

export const SignDigestInput = Schema.Struct({
  algorithm: Schema.Literals(["p256", "secp256k1"]),
  data: GcpWalletKeyData,
  hash: Schema.Uint8Array.check(Schema.isBetweenLength(32, 32)),
});

export const KeyReference = Schema.Struct({ data: GcpWalletKeyData });

export type CreateKeyInput = typeof CreateKeyInput.Type;

export type CreatedKey = typeof CreatedKey.Type;

export type SignMessageInput = typeof SignMessageInput.Type;

export type SignDigestInput = typeof SignDigestInput.Type;

export type KeyReference = typeof KeyReference.Type;
