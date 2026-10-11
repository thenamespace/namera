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
