import { Schema } from "effect";

import { SupportedEvmChainId } from "@namera-ai/protocol/evm";

import { RecipeExpiry } from "#/inputs/expiry";

import { usdcNetworks } from "./deployments.js";

export function usdcBaseUnits(value: string): bigint {
  const [whole = "0", fraction = ""] = value.split(".");
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
}

export const UsdcAllowanceInput = Schema.Struct({
  networks: Schema.Array(SupportedEvmChainId).check(
    Schema.isMinLength(1, { message: "Choose at least one network." }),
    Schema.makeFilter((networks) =>
      new Set(networks).size === networks.length &&
      networks.every((chainId) => usdcNetworks.includes(chainId))
        ? undefined
        : "Choose unique networks supported by this template.",
    ),
  ),
  allowance: Schema.String.check(
    Schema.makeFilter((value) => {
      if (!/^\d+(\.\d{1,6})?$/.test(value))
        return "Enter a USDC amount with up to 6 decimal places.";
      const amount = usdcBaseUnits(value);
      return amount > 0n && amount <= 2n ** 256n - 1n
        ? undefined
        : "Enter an amount greater than zero and within the token limit.";
    }),
  ),
  expiresAt: RecipeExpiry,
});
