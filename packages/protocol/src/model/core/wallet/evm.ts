import { Schema } from "effect";

import {
  AlchemyModularAccount7702Version,
  AlchemyModularAccountVersion,
  EntryPointVersion,
  EthereumAddress,
} from "#/evm/index";

const AlchemyModularV2WalletDataFields = {
  version: Schema.Literal(1),
  address: EthereumAddress,
  implementation: Schema.Literal("alchemy-modular-v2"),
  modularAccountVersion: AlchemyModularAccountVersion,
  entryPointVersion: EntryPointVersion,
};

export const AlchemyModularV2WebAuthnWalletData = Schema.Struct({
  ...AlchemyModularV2WalletDataFields,
  validatorType: Schema.Literal("webauthn_p256"),
  salt: Schema.BigIntFromString,
  entityId: Schema.Int,
});

export const AlchemyModularV2Eip7702WalletData = Schema.Struct({
  ...AlchemyModularV2WalletDataFields,
  validatorType: Schema.Literal("ecdsa_secp256k1"),
  accountMode: Schema.Literal("7702"),
  delegationVersion: AlchemyModularAccount7702Version,
});

export const AlchemyModularV2FactoryWalletData = Schema.Struct({
  ...AlchemyModularV2WalletDataFields,
  validatorType: Schema.Literal("ecdsa_secp256k1"),
  accountMode: Schema.Literal("factory"),
  factoryVersion: Schema.Literal("2.0.0"),
  implementationVersion: Schema.Literal("v1.0.0"),
  ownerAddress: EthereumAddress,
  salt: Schema.BigIntFromString.check(
    Schema.isGreaterThanOrEqualToBigInt(0n),
    Schema.isLessThanOrEqualToBigInt((1n << 256n) - 1n),
  ),
});

export const AlchemyModularV2WalletData = Schema.Union([
  AlchemyModularV2WebAuthnWalletData,
  AlchemyModularV2Eip7702WalletData,
  AlchemyModularV2FactoryWalletData,
]);

export const EvmWalletData = Schema.Struct({
  namespace: Schema.Literal("eip155"),
  data: AlchemyModularV2WalletData,
});

export type AlchemyModularV2WalletData = typeof AlchemyModularV2WalletData.Type;
export type AlchemyModularV2WebAuthnWalletData = typeof AlchemyModularV2WebAuthnWalletData.Type;
export type AlchemyModularV2Eip7702WalletData = typeof AlchemyModularV2Eip7702WalletData.Type;
export type AlchemyModularV2FactoryWalletData = typeof AlchemyModularV2FactoryWalletData.Type;
export type EvmWalletData = typeof EvmWalletData.Type;
