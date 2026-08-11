import { Schema } from "effect";

import { Hex } from "#/common/web3";

export const EvmValue = Schema.BigIntFromString.check(
  Schema.isGreaterThanOrEqualToBigInt(0n, {
    message: "EVM value must not be negative",
  }),
).annotate({
  identifier: "EvmValue",
  description: "A non-negative EVM value encoded as a base-10 integer string",
});

export const Bytes32 = Hex.check(
  Schema.isPattern(/^0x[0-9a-fA-F]{64}$/, {
    message: "Bytes32 must contain exactly 32 bytes",
  }),
)
  .pipe(Schema.brand("Bytes32"))
  .annotate({
    identifier: "Bytes32",
    description: "A 32-byte hexadecimal value",
  });

export const TransactionHash = Bytes32.pipe(Schema.brand("TransactionHash")).annotate({
  identifier: "TransactionHash",
  description: "An EVM transaction hash",
});

export const UserOperationHash = Bytes32.pipe(Schema.brand("UserOperationHash")).annotate({
  identifier: "UserOperationHash",
  description: "An ERC-4337 UserOperation hash",
});

export type EvmValue = typeof EvmValue.Type;
export type Bytes32 = typeof Bytes32.Type;
export type TransactionHash = typeof TransactionHash.Type;
export type UserOperationHash = typeof UserOperationHash.Type;
