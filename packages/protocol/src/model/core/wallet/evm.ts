import { Schema } from "effect";

import { EntryPointVersion, EthereumAddress, KernelVersion, ValidatorType } from "#/common/index";

export const KernelWalletData = Schema.Struct({
  version: Schema.Literal(1),
  implementation: Schema.Literal("kernel"),
  kernelVersion: KernelVersion,
  validatorType: ValidatorType,
  entryPointVersion: EntryPointVersion,
  accountIndex: Schema.BigIntFromString.check(
    Schema.isGreaterThanOrEqualToBigInt(0n, {
      message: "Account index must be non-negative",
    }),
  ),
});

export const EvmWalletData = Schema.Struct({
  family: Schema.Literal("evm"),
  address: EthereumAddress,
  data: KernelWalletData,
});

export type KernelWalletData = typeof KernelWalletData.Type;
export type EvmWalletData = typeof EvmWalletData.Type;
