import { Schema } from "effect";

import { formatUnits, parseUnits } from "viem";

import type { OnchainPermissionInput } from "@/components/policy/evm/onchain/catalog";

// Supported session networks use 18-decimal native currencies. Keep the wire
// amount in integer base units, never a floating-point number.
export const NativeBudgetForm = Schema.Struct({
  amount: Schema.String.check(
    Schema.isPattern(/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/, {
      message: "Enter a native-token amount with up to 18 decimal places",
    }),
    Schema.makeFilter((amount) => {
      if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(amount)) return undefined;
      return parseUnits(amount, 18) <= 2n ** 256n - 1n ? undefined : "Amount is too large";
    }),
  ),
});

export function toNativeBudgetPermission(
  type: "gas-limit" | "native-token-transfer",
  amount: string,
): OnchainPermissionInput {
  const baseUnits = parseUnits(amount, 18).toString();
  return type === "gas-limit" ? { type, limit: baseUnits } : { type, allowance: baseUnits };
}

export function nativeBudgetAmount(permission?: OnchainPermissionInput) {
  if (permission?.type === "gas-limit") return formatUnits(BigInt(permission.limit), 18);
  if (permission?.type === "native-token-transfer")
    return formatUnits(BigInt(permission.allowance), 18);
  return "";
}
