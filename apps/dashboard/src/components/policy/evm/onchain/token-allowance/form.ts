import { Schema } from "effect";

import { EthereumAddress } from "@namera-ai/protocol/evm";
import { formatUnits, parseUnits } from "viem";

import type { OnchainPermissionInput } from "../catalog";

export const TokenAllowanceForm = Schema.Struct({
  address: Schema.String.pipe(Schema.decodeTo(EthereumAddress)),
  amount: Schema.String.check(
    Schema.isPattern(/^(?:0|[1-9]\d*)(?:\.\d+)?$/, {
      message: "Enter a non-negative token amount",
    }),
  ),
  decimals: Schema.String.check(
    Schema.isPattern(/^\d{1,3}$/, { message: "Enter token decimals from 0 to 255" }),
  ).pipe(
    Schema.decodeTo(
      Schema.NumberFromString.check(
        Schema.isInt(),
        Schema.isGreaterThanOrEqualTo(0),
        Schema.isLessThanOrEqualTo(255),
      ),
    ),
  ),
}).check(
  Schema.makeFilter(({ amount, decimals }) => {
    if ((amount.split(".")[1]?.length ?? 0) > decimals)
      return { path: ["amount"], issue: `Use at most ${decimals} decimal places` };
    if (parseUnits(amount, decimals) > 2n ** 256n - 1n)
      return { path: ["amount"], issue: "Amount is too large" };
    return undefined;
  }),
);

export function tokenAllowanceDefaults(permission?: OnchainPermissionInput) {
  return {
    address: permission?.type === "erc20-token-transfer" ? permission.address : "",
    amount:
      permission?.type === "erc20-token-transfer"
        ? formatUnits(BigInt(permission.allowance), 6)
        : "",
    decimals: "6",
  };
}

export function toTokenAllowancePermission(
  value: typeof TokenAllowanceForm.Type,
): OnchainPermissionInput {
  return {
    type: "erc20-token-transfer",
    address: value.address,
    allowance: parseUnits(value.amount, value.decimals).toString(),
  };
}
