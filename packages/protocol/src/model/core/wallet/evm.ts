import { Schema } from "effect";

import { ValidatorType } from "#/common/index";
import { EntryPointVersion, EthereumAddress, KernelVersion, SafeVersion } from "#/evm/index";

export const KernelWalletData = Schema.Struct({
  version: Schema.Literal(1),
  address: EthereumAddress,
  implementation: Schema.Literal("kernel"),
  kernelVersion: KernelVersion,
  validatorType: ValidatorType,
  entryPointVersion: EntryPointVersion,
  accountIndex: Schema.BigIntFromString,
});

export const SafeWalletData = Schema.Struct({
  version: Schema.Literal(1),
  address: EthereumAddress,
  implementation: Schema.Literal("safe"),
  validatorType: ValidatorType,
  safeVersion: SafeVersion,
  entryPointVersion: EntryPointVersion,
  saltNonce: Schema.BigIntFromString,
});

export const EvmWalletData = Schema.Struct({
  namespace: Schema.Literal("eip155"),
  data: Schema.Union([KernelWalletData, SafeWalletData]),
});

export type KernelWalletData = typeof KernelWalletData.Type;
export type SafeWalletData = typeof SafeWalletData.Type;
export type EvmWalletData = typeof EvmWalletData.Type;
