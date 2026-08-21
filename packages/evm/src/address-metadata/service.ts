import { DateTime, Effect, Option, Schema } from "effect";
import type { HttpClient } from "effect/unstable/http";

import { EthereumAddress } from "@namera-ai/protocol";

import { makeBlockscoutClient } from "../blockscout/client.js";
import { BlockscoutAddress, BlockscoutMetadata, BlockscoutSearch } from "../blockscout/schemas.js";
import { getChainDataByCaip2 } from "../chains/helpers.js";
import type { EvmConfigValues } from "../config.js";
import { normalizeBlockscoutAddress } from "./normalize.js";
import type { EvmAddressMetadataService } from "./types.js";

export const makeEvmAddressMetadataService = (
  config: EvmConfigValues,
  httpClient: HttpClient.HttpClient,
): EvmAddressMetadataService => {
  const client = makeBlockscoutClient(config, httpClient);

  const resolve = Effect.fn("evm.addressMetadata.resolve")(function* (
    input: Parameters<EvmAddressMetadataService["resolve"]>[0],
  ) {
    if (input.addresses.length === 0) return [];
    const chain = getChainDataByCaip2(input.chainId);
    if (chain === undefined) return [];
    const observedAt = yield* DateTime.now;
    const metadata = yield* client
      .getMetadata("address-metadata", BlockscoutMetadata, {
        addresses: input.addresses.join(","),
        chainId: String(chain.chain.id),
        tagsLimit: "20",
      })
      .pipe(Effect.catch(() => Effect.succeed(null)));
    const details = yield* Effect.forEach(
      input.addresses,
      (address) =>
        client
          .get("address-detail", input.chainId, `/addresses/${address}`, BlockscoutAddress)
          .pipe(
            Effect.map((detail) =>
              normalizeBlockscoutAddress({
                address,
                chainId: input.chainId,
                detail,
                metadata,
                observedAt,
              }),
            ),
          ),
      { concurrency: 4 },
    );
    return details;
  });

  const search = Effect.fn("evm.addressMetadata.search")(function* (
    input: Parameters<EvmAddressMetadataService["search"]>[0],
  ) {
    const response = yield* client.get(
      "address-search",
      input.chainId,
      "/search",
      BlockscoutSearch,
      { q: input.query },
    );
    return response.items.flatMap((item) => {
      const decoded = Schema.decodeUnknownOption(EthereumAddress)(item.address_hash?.toLowerCase());
      return Option.isSome(decoded) ? [decoded.value] : [];
    });
  });

  return { resolve, search };
};
