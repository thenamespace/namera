import { Schema } from "effect";

import { AlchemyModularAccountVersion, EntryPointVersion, EthereumAddress } from "#/evm/index";

export const AlchemyModularV2WalletData = Schema.Struct({
  version: Schema.Literal(1),
  address: EthereumAddress,
  implementation: Schema.Literal("alchemy-modular-v2"),
  modularAccountVersion: AlchemyModularAccountVersion,
  validatorType: Schema.Literal("webauthn_p256"),
  entryPointVersion: EntryPointVersion,
  salt: Schema.BigIntFromString,
  entityId: Schema.Int,
});

export const EvmWalletData = Schema.Struct({
  namespace: Schema.Literal("eip155"),
  data: AlchemyModularV2WalletData,
});

export type AlchemyModularV2WalletData = typeof AlchemyModularV2WalletData.Type;
export type EvmWalletData = typeof EvmWalletData.Type;
