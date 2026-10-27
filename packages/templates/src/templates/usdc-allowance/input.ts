import { DateTime, Option, Schema } from "effect";

import { SupportedEvmChainId } from "@namera-ai/protocol/evm";

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
  expiresAt: Schema.String.check(
    Schema.makeFilter((value) => {
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value))
        return "Choose an expiry date.";
      const date = DateTime.make(value);
      return Option.isSome(date) &&
        DateTime.formatIso(date.value) ===
          (value.includes(".") ? value : value.replace("Z", ".000Z"))
        ? undefined
        : "Choose a valid expiry date.";
    }),
  ),
});

export type UsdcAllowanceInput = typeof UsdcAllowanceInput.Type;
