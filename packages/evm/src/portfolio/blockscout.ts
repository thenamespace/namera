import { DateTime, Effect, Option, Result, Schema } from "effect";
import type { HttpClient } from "effect/unstable/http";

import {
  EthereumAddress,
  EvmPortfolioError,
  Hex,
  type SupportedEvmChainId,
} from "@namera-ai/protocol";
import type { PortfolioAsset } from "@namera-ai/protocol/dto";
import type { EvmAddressMetadataData } from "@namera-ai/protocol/model";
import { formatUnits, toHex } from "viem";

import {
  getBlockscoutMetadataTags,
  hasCredibleBlockscoutTag,
  normalizeBlockscoutTags,
} from "../address-metadata/normalize.js";
import { makeBlockscoutClient } from "../blockscout/client.js";
import {
  BlockscoutAddress,
  BlockscoutAddressTokens,
  BlockscoutMetadata,
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

const iconUrl = (value: string | null | undefined): string | null => {
  const candidate = nonEmpty(value);
  if (candidate === null) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
};

const tokenAddressMetadata = (
  chainId: SupportedEvmChainId,
  address: EthereumAddress,
  token: BlockscoutToken,
  updatedAt: DateTime.Utc,
): EvmAddressMetadataData => {
  const reputation = token.reputation?.toLowerCase();
  const isScam = reputation === "scam";
  const hasMarketData = nonEmpty(token.exchange_rate) !== null;
  const name = nonEmpty(token.name);
  const symbol = nonEmpty(token.symbol);
  const logoUrl = iconUrl(token.icon_url);

  return {
    schemaVersion: 1,
    namespace: "eip155",
    chainId,
    address,
    kind: "fungible-token",
    identity: { displayName: name ?? symbol, description: null, iconUrl: logoUrl },
    trust: {
      reputation: isScam ? "scam" : "neutral",
      isScam,
      isSourceVerified: null,
      signals: hasMarketData ? ["blockscout", "token-market"] : ["blockscout"],
    },
    tags: [],
    token: {
      standard: "erc20",
      name,
      symbol,
      decimals: decimals(token),
      logoUrl,
    },
    contract: {
      name,
      proxyType: null,
      implementationAddress: null,
      implementationName: null,
    },
    provenance: { provider: "blockscout", observedAt: updatedAt },
  };
};

const applyMetadataTags = (
  asset: PortfolioAsset,
  metadata: BlockscoutMetadata | null,
): PortfolioAsset => {
  if (asset.addressMetadata === null || asset.tokenAddress === null) return asset;
  const rawTags = getBlockscoutMetadataTags(metadata, asset.tokenAddress);
  if (rawTags.length === 0) return asset;
  const tags = normalizeBlockscoutTags(rawTags);
  const displayName = tags.find((tag) => tag.type === "name")?.name;
  return {
    ...asset,
    addressMetadata: {
      ...asset.addressMetadata,
      identity: {
        ...asset.addressMetadata.identity,
        displayName: displayName ?? asset.addressMetadata.identity.displayName,
      },
      trust: {
        ...asset.addressMetadata.trust,
        reputation: hasCredibleBlockscoutTag(rawTags)
          ? "credible"
          : asset.addressMetadata.trust.reputation,
        signals: [...asset.addressMetadata.trust.signals, "metadata-tag"],
      },
      tags,
    },
  };
};

const tokenAsset = (
  chainId: SupportedEvmChainId,
  token: BlockscoutToken,
  balance: bigint,
  updatedAt: DateTime.Utc,
): PortfolioAsset | null => {
  if (balance === 0n || token.reputation === "scam") return null;
  const tokenAddress = Schema.decodeUnknownOption(EthereumAddress)(
    token.address_hash.toLowerCase(),
  );
  if (Option.isNone(tokenAddress)) return null;
  const chainDecimals = decimals(token);
  return {
    namespace: "eip155",
    chainId,
    type: "erc20",
    tokenAddress: tokenAddress.value,
    rawBalance: Hex.make(toHex(balance)),
    formattedBalance: chainDecimals === null ? null : formatUnits(balance, chainDecimals),
    metadata: {
      name: nonEmpty(token.name),
      symbol: nonEmpty(token.symbol),
      decimals: chainDecimals,
      logoUrl: iconUrl(token.icon_url),
    },
    addressMetadata: tokenAddressMetadata(chainId, tokenAddress.value, token, updatedAt),
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

    const tokenAddresses = items.flatMap((asset) =>
      asset.tokenAddress === null ? [] : [asset.tokenAddress],
    );
    const metadata =
      tokenAddresses.length === 0
        ? null
        : yield* client
            .getMetadata("address-metadata", BlockscoutMetadata, {
              addresses: tokenAddresses.join(","),
              chainId: String(chain.chain.id),
              tagsLimit: "20",
            })
            .pipe(Effect.catch(() => Effect.succeed(null)));

    return items.map((asset) => applyMetadataTags(asset, metadata));
  });

  const getAssets = Effect.fn("evm.portfolio.getAssets")(function* (input: GetEvmPortfolioInput) {
    const chainIds = input.chainIds ?? Object.values(chains).map((chain) => chain.chainId);
    const results = yield* Effect.forEach(
      chainIds,
      (chainId) => Effect.result(getChainAssets(input.address, chainId)),
      { concurrency: 2 },
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
