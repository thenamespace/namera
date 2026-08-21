import { Schema } from "effect";

import { EthereumAddress, Hex, SupportedEvmChainId } from "#/evm/index";
import { NonEmptyString } from "#/model/index";

export const WalletAssetCursor = NonEmptyString.annotate({
  identifier: "WalletAssetCursor",
  description: "Opaque cursor for the next page of wallet assets",
});

export const ListWalletAssetsRequest = Schema.Struct({
  cursor: Schema.optionalKey(WalletAssetCursor),
}).annotate({
  identifier: "ListWalletAssetsRequest",
  description: "Optional pagination cursor for an all-chain wallet asset list",
});

export const WalletAssetMetadata = Schema.Struct({
  name: Schema.NullOr(NonEmptyString),
  symbol: Schema.NullOr(NonEmptyString),
  decimals: Schema.NullOr(
    Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 0, maximum: 255 }))),
  ),
  logoUrl: Schema.NullOr(NonEmptyString),
}).annotate({ identifier: "WalletAssetMetadata" });

export const WalletAssetUsdPrice = Schema.Struct({
  value: NonEmptyString,
  updatedAt: Schema.DateTimeUtcFromString,
}).annotate({ identifier: "WalletAssetUsdPrice" });

export const EvmWalletAsset = Schema.Struct({
  namespace: Schema.Literal("eip155"),
  chainId: SupportedEvmChainId,
  type: Schema.Literals(["native", "erc20"]),
  tokenAddress: Schema.NullOr(EthereumAddress),
  rawBalance: Hex,
  formattedBalance: Schema.NullOr(NonEmptyString),
  metadata: WalletAssetMetadata,
  usdPrice: Schema.NullOr(WalletAssetUsdPrice),
}).annotate({
  identifier: "EvmWalletAsset",
  description: "A native or ERC-20 balance held by an EVM wallet",
});

export const WalletAsset = Schema.Union([EvmWalletAsset], { mode: "oneOf" }).annotate({
  identifier: "WalletAsset",
});

export const WalletAssetPartialFailure = Schema.Struct({
  chainId: SupportedEvmChainId,
  code: Schema.Literal("PROVIDER_UNAVAILABLE"),
}).annotate({
  identifier: "WalletAssetPartialFailure",
  description: "A chain whose assets could not be included in this response",
});

export const ListWalletAssetsResponse = Schema.Struct({
  items: Schema.Array(WalletAsset),
  nextCursor: Schema.NullOr(WalletAssetCursor),
  partialFailures: Schema.Array(WalletAssetPartialFailure),
}).annotate({
  identifier: "ListWalletAssetsResponse",
  description: "A page of fungible wallet assets across supported EVM chains",
});

export type WalletAssetCursor = typeof WalletAssetCursor.Type;
export type ListWalletAssetsRequest = typeof ListWalletAssetsRequest.Type;
export type WalletAssetMetadata = typeof WalletAssetMetadata.Type;
export type WalletAssetUsdPrice = typeof WalletAssetUsdPrice.Type;
export type EvmWalletAsset = typeof EvmWalletAsset.Type;
export type WalletAsset = typeof WalletAsset.Type;
export type WalletAssetPartialFailure = typeof WalletAssetPartialFailure.Type;
export type ListWalletAssetsResponse = typeof ListWalletAssetsResponse.Type;
