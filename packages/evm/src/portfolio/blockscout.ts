import { DateTime, Effect, Result } from "effect";
import type { HttpClient } from "effect/unstable/http";

import { EvmPortfolioError, Hex, type SupportedEvmChainId } from "@namera-ai/protocol";
import type { PortfolioAsset } from "@namera-ai/protocol/dto";
import { formatUnits, toHex } from "viem";

import { makeBlockscoutClient } from "../blockscout/client.js";
import {
  BlockscoutAddress,
  BlockscoutAddressTokens,
  type BlockscoutToken,
} from "../blockscout/schemas.js";
import { chains } from "../chains/data.js";
import { getChainDataByCaip2 } from "../chains/helpers.js";
import type { EvmConfigValues } from "../config.js";
import type { EvmPortfolioService, GetEvmPortfolioInput } from "./types.js";

const nonEmpty = (value: string | null | undefined): string | null => {
  const normalized = value?.trim();
  return normalized === undefined || normalized.length === 0 ? null : normalized;
};

const decimals = (token: BlockscoutToken): number | null => {
  if (token.decimals === undefined || token.decimals === null) return null;
  const value = Number(token.decimals);
  return Number.isInteger(value) && value >= 0 && value <= 255 ? value : null;
};

const usdPrice = (value: string | null | undefined, updatedAt: DateTime.Utc) => {
  const normalized = nonEmpty(value);
  return normalized === null ? null : { value: normalized, updatedAt };
};

const tokenAsset = (
  chainId: SupportedEvmChainId,
  token: BlockscoutToken,
  balance: bigint,
  updatedAt: DateTime.Utc,
): PortfolioAsset | null => {
  if (balance === 0n || token.reputation === "scam") return null;
  const chainDecimals = decimals(token);
  return {
    namespace: "eip155",
    chainId,
    type: "erc20",
    tokenAddress: token.address_hash.toLowerCase() as PortfolioAsset["tokenAddress"],
    rawBalance: Hex.make(toHex(balance)),
    formattedBalance: chainDecimals === null ? null : formatUnits(balance, chainDecimals),
    metadata: {
      name: nonEmpty(token.name),
      symbol: nonEmpty(token.symbol),
      decimals: chainDecimals,
      logoUrl: nonEmpty(token.icon_url),
    },
    addressMetadata: null,
    usdPrice: usdPrice(token.exchange_rate, updatedAt),
  };
};

const cursorParams = (value: Readonly<Record<string, unknown>> | null | undefined) =>
  Object.fromEntries(
    Object.entries(value ?? {}).flatMap(([key, item]) =>
      typeof item === "string" || typeof item === "number" ? [[key, String(item)]] : [],
    ),
  );

export const makeBlockscoutPortfolioService = (
  config: EvmConfigValues,
  httpClient: HttpClient.HttpClient,
): EvmPortfolioService => {
  const client = makeBlockscoutClient(config, httpClient);

  const getChainAssets = Effect.fn("evm.portfolio.getChainAssets")(function* (
    address: GetEvmPortfolioInput["address"],
    chainId: SupportedEvmChainId,
  ) {
    const chain = getChainDataByCaip2(chainId);
    if (chain === undefined) return [];
    const updatedAt = yield* DateTime.now;
    const detail = yield* client.get(
      "portfolio",
      chainId,
      `/addresses/${address}`,
      BlockscoutAddress,
    );
    const nativeBalance = BigInt(detail.coin_balance ?? "0");
    const items: Array<PortfolioAsset> = [];
    if (nativeBalance > 0n) {
      items.push({
        namespace: "eip155",
        chainId,
        type: "native",
        tokenAddress: null,
        rawBalance: Hex.make(toHex(nativeBalance)),
        formattedBalance: formatUnits(nativeBalance, chain.chain.nativeCurrency.decimals),
        metadata: {
          name: chain.chain.nativeCurrency.name,
          symbol: chain.chain.nativeCurrency.symbol,
          decimals: chain.chain.nativeCurrency.decimals,
          logoUrl: null,
        },
        addressMetadata: null,
        usdPrice: usdPrice(detail.exchange_rate, updatedAt),
      });
    }

    let next: Readonly<Record<string, unknown>> | null | undefined;
    do {
      const page = yield* client.get(
        "portfolio",
        chainId,
        `/addresses/${address}/tokens`,
        BlockscoutAddressTokens,
        { type: "ERC-20", ...cursorParams(next) },
      );
      for (const holding of page.items) {
        const asset = tokenAsset(chainId, holding.token, BigInt(holding.value), updatedAt);
        if (asset !== null) items.push(asset);
      }
      next = page.next_page_params;
    } while (next !== undefined && next !== null);

    return items;
  });

  const getAssets = Effect.fn("evm.portfolio.getAssets")(function* (input: GetEvmPortfolioInput) {
    const chainIds = input.chainIds ?? Object.values(chains).map((chain) => chain.chainId);
    const results = yield* Effect.forEach(
      chainIds,
      (chainId) => Effect.result(getChainAssets(input.address, chainId)),
      { concurrency: 4 },
    );
    const items = results.flatMap((result) => (Result.isSuccess(result) ? result.success : []));
    const partialFailures = results.flatMap((result, index) => {
      const chainId = chainIds[index];
      return Result.isFailure(result) && chainId !== undefined
        ? [{ chainId, code: "PROVIDER_UNAVAILABLE" as const }]
        : [];
    });
    if (items.length === 0 && partialFailures.length === chainIds.length) {
      return yield* new EvmPortfolioError({
        code: "PROVIDER_UNAVAILABLE",
        cause: new Error("Blockscout portfolio was unavailable for every requested chain"),
      });
    }
    return { items, partialFailures };
  });

  return { getAssets };
};
