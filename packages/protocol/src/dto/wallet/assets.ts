import { Schema } from "effect";

import { EthereumAddress, Hex, SupportedEvmChainId } from "#/evm/index";
import { EvmAddressMetadataData } from "#/model/core/address-metadata";
import { NonEmptyString } from "#/model/index";

export const PortfolioCursor = NonEmptyString.annotate({
  identifier: "PortfolioCursor",
  description: "Opaque cursor for the next portfolio page",
});

const PortfolioPageSize = Schema.Int.pipe(
  Schema.check(Schema.isBetween({ minimum: 1, maximum: 100 })),
);

export const QueryPortfolioRequest = Schema.Struct({
  namespace: Schema.Literal("eip155"),
  address: EthereumAddress,
  chainIds: Schema.optionalKey(Schema.Array(SupportedEvmChainId)),
  cursor: Schema.optionalKey(PortfolioCursor),
  pageSize: Schema.optionalKey(PortfolioPageSize),
}).annotate({
  identifier: "QueryPortfolioRequest",
  description: "Query fungible assets for a namespace-qualified address",
});

export const GetWalletPortfolioRequest = Schema.Struct({
  cursor: Schema.optionalKey(PortfolioCursor),
  pageSize: Schema.optionalKey(PortfolioPageSize),
}).annotate({ identifier: "GetWalletPortfolioRequest" });

export const PortfolioAssetMetadata = Schema.Struct({
  name: Schema.NullOr(NonEmptyString),
  symbol: Schema.NullOr(NonEmptyString),
  decimals: Schema.NullOr(
    Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 0, maximum: 255 }))),
  ),
  logoUrl: Schema.NullOr(NonEmptyString),
}).annotate({ identifier: "PortfolioAssetMetadata" });

export const PortfolioAssetUsdPrice = Schema.Struct({
  value: NonEmptyString,
  updatedAt: Schema.DateTimeUtcFromString,
}).annotate({ identifier: "PortfolioAssetUsdPrice" });

export const EvmPortfolioAsset = Schema.Struct({
  namespace: Schema.Literal("eip155"),
  chainId: SupportedEvmChainId,
  type: Schema.Literals(["native", "erc20"]),
  tokenAddress: Schema.NullOr(EthereumAddress),
  rawBalance: Hex,
  formattedBalance: Schema.NullOr(NonEmptyString),
  metadata: PortfolioAssetMetadata,
  addressMetadata: Schema.NullOr(EvmAddressMetadataData),
  usdPrice: Schema.NullOr(PortfolioAssetUsdPrice),
}).annotate({
  identifier: "EvmPortfolioAsset",
  description: "A native or ERC-20 balance held by an EVM address",
});

export const PortfolioAsset = Schema.Union([EvmPortfolioAsset], { mode: "oneOf" }).annotate({
  identifier: "PortfolioAsset",
});

export const PortfolioChainSummary = Schema.Struct({
  chainId: SupportedEvmChainId,
  assetCount: Schema.Int,
  pricedAssetCount: Schema.Int,
  totalValueUsd: NonEmptyString,
}).annotate({ identifier: "PortfolioChainSummary" });

export const PortfolioSummary = Schema.Struct({
  assetCount: Schema.Int,
  pricedAssetCount: Schema.Int,
  unpricedAssetCount: Schema.Int,
  totalValueUsd: NonEmptyString,
}).annotate({ identifier: "PortfolioSummary" });

export const PortfolioPartialFailure = Schema.Struct({
  chainId: SupportedEvmChainId,
  code: Schema.Literal("PROVIDER_UNAVAILABLE"),
}).annotate({
  identifier: "PortfolioPartialFailure",
  description: "A chain whose balances could not be included",
});

export const PortfolioResponse = Schema.Struct({
  namespace: Schema.Literal("eip155"),
  address: EthereumAddress,
  summary: PortfolioSummary,
  chains: Schema.Array(PortfolioChainSummary),
  items: Schema.Array(PortfolioAsset),
  nextCursor: Schema.NullOr(PortfolioCursor),
  partialFailures: Schema.Array(PortfolioPartialFailure),
}).annotate({
  identifier: "PortfolioResponse",
  description: "A paginated all-chain fungible portfolio",
});

export type PortfolioCursor = typeof PortfolioCursor.Type;
export type QueryPortfolioRequest = typeof QueryPortfolioRequest.Type;
export type GetWalletPortfolioRequest = typeof GetWalletPortfolioRequest.Type;
export type PortfolioAssetMetadata = typeof PortfolioAssetMetadata.Type;
export type PortfolioAssetUsdPrice = typeof PortfolioAssetUsdPrice.Type;
export type EvmPortfolioAsset = typeof EvmPortfolioAsset.Type;
export type PortfolioAsset = typeof PortfolioAsset.Type;
export type PortfolioChainSummary = typeof PortfolioChainSummary.Type;
export type PortfolioSummary = typeof PortfolioSummary.Type;
export type PortfolioPartialFailure = typeof PortfolioPartialFailure.Type;
export type PortfolioResponse = typeof PortfolioResponse.Type;
