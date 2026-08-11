import { Schema } from "effect";

import { EntryPointVersion, EthereumAddress, KernelVersion, ValidatorType } from "#/common/index";

export const KernelWalletData = Schema.Struct({
  version: Schema.Literal(1),
  address: EthereumAddress,
  implementation: Schema.Literal("kernel"),
  kernelVersion: KernelVersion,
  validatorType: ValidatorType,
  entryPointVersion: EntryPointVersion,
  accountIndex: Schema.BigIntFromString,
});

export const EvmWalletData = Schema.Struct({
  namespace: Schema.Literal("eip155"),
  data: KernelWalletData,
});

export type KernelWalletData = typeof KernelWalletData.Type;
export type EvmWalletData = typeof EvmWalletData.Type;
