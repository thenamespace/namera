import { Schema } from "effect";

import { OrganizationId, SigningKeyId, VerificationId, WalletId } from "#/common/index";
import {
  AlchemyModularAccount7702Version,
  AlchemyModularAccountVersion,
  EntryPointVersion,
  EthereumAddress,
} from "#/evm/index";
import {
  TimestampFields,
  SigningKeyAlgorithm,
  WalletKeyProtectionLevel,
  WalletMetadata,
  WalletStatus,
} from "#/model/index";

import { PasskeyRegistrationResponse } from "./passkey.js";

export * from "./assets.js";
export * from "./passkey.js";

export const CreateWalletOwnerRequest = Schema.Union([
  Schema.Struct({
    type: Schema.Literal("namera-managed"),
    provider: Schema.Literal("1claw"),
    protectionLevel: Schema.optionalKey(Schema.Never),
  }),
  Schema.Struct({
    type: Schema.Literal("namera-managed"),
    provider: Schema.optionalKey(Schema.Never),
    protectionLevel: WalletKeyProtectionLevel,
  }),
  Schema.Struct({
    type: Schema.Literal("passkey"),
    verificationId: VerificationId,
    response: PasskeyRegistrationResponse,
  }),
]).annotate({
  identifier: "CreateWalletOwnerRequest",
  description: "The managed or user-controlled signing key that will own the wallet",
});

export const CreateEvmWalletRequest = Schema.Struct({
  namespace: Schema.Literal("eip155"),
  owner: CreateWalletOwnerRequest,
  metadata: WalletMetadata,
}).annotate({
  identifier: "CreateEvmWalletRequest",
  description: "Create an EVM smart-account wallet",
});

export const CreateWalletRequest = CreateEvmWalletRequest.annotate({
  identifier: "CreateWalletRequest",
  description: "Create a wallet with a managed key or a user-controlled passkey",
});

export const WalletOwnerResponse = Schema.Union([
  Schema.Struct({
    signingKeyId: SigningKeyId,
    custody: Schema.Literal("namera-managed"),
    provider: Schema.Literal("1claw"),
    algorithm: Schema.Literal("secp256k1"),
    protectionLevel: Schema.optionalKey(Schema.Never),
  }),
  Schema.Struct({
    signingKeyId: SigningKeyId,
    custody: Schema.Literal("local"),
    algorithm: SigningKeyAlgorithm,
  }),
  Schema.Struct({
    signingKeyId: SigningKeyId,
    custody: Schema.Literal("namera-managed"),
    provider: Schema.optionalKey(Schema.Never),
    algorithm: SigningKeyAlgorithm,
    protectionLevel: WalletKeyProtectionLevel,
  }),
]).annotate({
  identifier: "WalletOwnerResponse",
  description: "Safe signing-key ownership details for a wallet",
});

const WalletResponseFields = {
  id: WalletId,
  organizationId: OrganizationId,
  metadata: WalletMetadata,
  status: WalletStatus,
  namespace: Schema.Literal("eip155"),
  address: EthereumAddress,
  owner: WalletOwnerResponse,
  ...TimestampFields,
};

const AlchemyModularV2ResponseFields = {
  ...WalletResponseFields,
  implementation: Schema.Literal("alchemy-modular-v2"),
};

export const AlchemyModularV2WebAuthnWalletResponse = Schema.Struct({
  ...AlchemyModularV2ResponseFields,
  data: Schema.Struct({
    version: Schema.Literal(1),
    modularAccountVersion: AlchemyModularAccountVersion,
    validatorType: Schema.Literal("webauthn_p256"),
    entryPointVersion: EntryPointVersion,
    salt: Schema.BigIntFromString,
    entityId: Schema.Int,
  }),
}).annotate({
  identifier: "AlchemyModularV2WebAuthnWalletResponse",
  description: "An Alchemy Modular Account V2 wallet using P-256 WebAuthn validation",
});

export const AlchemyModularV2Eip7702WalletResponse = Schema.Struct({
  ...AlchemyModularV2ResponseFields,
  data: Schema.Struct({
    version: Schema.Literal(1),
    modularAccountVersion: AlchemyModularAccountVersion,
    validatorType: Schema.Literal("ecdsa_secp256k1"),
    entryPointVersion: EntryPointVersion,
    accountMode: Schema.Literal("7702"),
    delegationVersion: AlchemyModularAccount7702Version,
  }),
}).annotate({
  identifier: "AlchemyModularV2Eip7702WalletResponse",
  description: "An Alchemy Modular Account V2 wallet using secp256k1 EIP-7702 validation",
});

export const AlchemyModularV2WalletResponse = Schema.Union([
  AlchemyModularV2WebAuthnWalletResponse,
  AlchemyModularV2Eip7702WalletResponse,
]).annotate({
  identifier: "AlchemyModularV2WalletResponse",
  description: "An Alchemy Modular Account V2 wallet",
});

export const EvmWalletResponse = AlchemyModularV2WalletResponse.annotate({
  identifier: "EvmWalletResponse",
  description: "An EVM smart-account wallet",
});

export const WalletResponse = Schema.Union([EvmWalletResponse], { mode: "oneOf" }).annotate({
  identifier: "WalletResponse",
  description: "A wallet with its smart-account and key-protection details",
});

export const CreateWalletResponse = WalletResponse.annotate({
  identifier: "CreateWalletResponse",
});

export const GetWalletRequest = Schema.Struct({
  walletId: WalletId,
}).annotate({ identifier: "GetWalletRequest" });

export const GetWalletResponse = WalletResponse.annotate({
  identifier: "GetWalletResponse",
});

export const UpdateWalletRequest = Schema.Struct({
  metadata: WalletMetadata,
}).annotate({
  identifier: "UpdateWalletRequest",
  description: "Update wallet presentation metadata",
});

export const UpdateWalletResponse = WalletResponse.annotate({
  identifier: "UpdateWalletResponse",
});

export const ListWalletsResponse = Schema.Array(WalletResponse).annotate({
  identifier: "ListWalletsResponse",
});

export type CreateEvmWalletRequest = typeof CreateEvmWalletRequest.Type;
export type CreateWalletOwnerRequest = typeof CreateWalletOwnerRequest.Type;
export type CreateWalletRequest = typeof CreateWalletRequest.Type;
export type CreateWalletRequestEncoded = typeof CreateWalletRequest.Encoded;
export type EvmWalletResponse = typeof EvmWalletResponse.Type;
export type WalletResponse = typeof WalletResponse.Type;
export type WalletOwnerResponse = typeof WalletOwnerResponse.Type;
export type CreateWalletResponse = typeof CreateWalletResponse.Type;
export type GetWalletRequest = typeof GetWalletRequest.Type;
export type GetWalletResponse = typeof GetWalletResponse.Type;
export type UpdateWalletRequest = typeof UpdateWalletRequest.Type;
export type UpdateWalletResponse = typeof UpdateWalletResponse.Type;
export type ListWalletsResponse = typeof ListWalletsResponse.Type;
