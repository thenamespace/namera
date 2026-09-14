import { Schema } from "effect";

import { PolicyId } from "#/common/index";
import { EthereumAddress } from "#/evm/primitives";

const fields = {
  type: Schema.Literal("evm.erc20-token-transfer"),
  version: Schema.Literal(1),
  address: EthereumAddress,
  allowance: Schema.BigIntFromString.check(
    Schema.isGreaterThanOrEqualToBigInt(0n),
    Schema.isLessThanOrEqualToBigInt(2n ** 256n - 1n),
  ),
};

export const CreateEvmTokenSpendPolicy = Schema.Struct(fields).annotate({
  description:
    "Token-only API session: cumulative direct ERC-20 transfers and approvals per chain. Other calls are denied; external spending is not tracked.",
});
export const EvmTokenSpendPolicy = Schema.Struct({
  id: PolicyId,
  appliesTo: Schema.Literal("execution"),
  ...fields,
});
export type EvmTokenSpendPolicy = typeof EvmTokenSpendPolicy.Type;
