import { Schema } from "effect";

import { SupportedEvmChainId } from "@namera-ai/protocol/evm";
import { isAddress } from "viem";

export const customAddressSchema = (chainIds: readonly SupportedEvmChainId[]) =>
  Schema.Struct({
    address: Schema.String.check(
      Schema.makeFilter((address) => isAddress(address), {
        message: "Check the address and its checksum",
      }),
    ),
    chainId: SupportedEvmChainId.check(
      Schema.makeFilter((chainId) => chainIds.includes(chainId), {
        message: "Choose an allowed network",
      }),
    ),
  });

export const customPickerSchema = (
  chainIds: readonly SupportedEvmChainId[],
  requireDecimals: boolean,
) =>
  Schema.Struct({
    ...customAddressSchema(chainIds).fields,
    decimals: Schema.optionalKey(Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 255 }))),
  }).check(
    Schema.makeFilter((value) => !requireDecimals || value.decimals !== undefined, {
      message: "Enter token decimals (0–255)",
      path: ["decimals"],
    }),
  );
