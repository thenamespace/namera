import { Effect, Redacted, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";

import { EvmPortfolioError, Hex } from "@namera-ai/protocol";
import { ListWalletAssetsResponse } from "@namera-ai/protocol/dto";
import { formatUnits } from "viem";

import { chains, type AlchemyChain, type ChainData } from "../chains/data.js";
import type { EvmConfigValues } from "../config.js";
import type { EvmPortfolioService, GetEvmPortfolioInput } from "./types.js";

const AlchemyTokenMetadata = Schema.Struct({
  decimals: Schema.NullOr(Schema.Int),
  logo: Schema.NullOr(Schema.String),
  name: Schema.NullOr(Schema.String),
  symbol: Schema.NullOr(Schema.String),
});

const AlchemyTokenPrice = Schema.Struct({
  currency: Schema.String,
  value: Schema.String,
  lastUpdatedAt: Schema.String,
});

const AlchemyPortfolioResponse = Schema.Struct({
  data: Schema.Struct({
    tokens: Schema.Array(
      Schema.Struct({
        address: Schema.String,
        network: Schema.String,
        tokenAddress: Schema.NullOr(Schema.String),
        tokenBalance: Hex,
        tokenMetadata: Schema.optionalKey(Schema.NullOr(AlchemyTokenMetadata)),
        tokenPrices: Schema.optionalKey(Schema.NullOr(Schema.Array(AlchemyTokenPrice))),
      }),
    ),
    pageKey: Schema.optionalKey(Schema.String),
  }),
  error: Schema.optionalKey(
    Schema.Struct({
      message: Schema.String,
      partialErrors: Schema.Array(
        Schema.Struct({ network: Schema.String, message: Schema.String }),
      ),
    }),
  ),
});

type AlchemyPortfolioResponse = typeof AlchemyPortfolioResponse.Type;

const chainByAlchemyNetwork = new Map<AlchemyChain, ChainData>(
  Object.values(chains).map((chain) => [chain.alchemyChain, chain]),
);

const nonEmptyOrNull = (value: string | null | undefined): string | null =>
  value === undefined || value === null || value.length === 0 ? null : value;

const normalizeAlchemyPortfolio = Effect.fn("evm.portfolio.normalizeAlchemyPortfolio")(function* (
  response: AlchemyPortfolioResponse,
) {
  const items = response.data.tokens.flatMap((token) => {
    const chain = chainByAlchemyNetwork.get(token.network as AlchemyChain);
    if (chain === undefined || BigInt(token.tokenBalance) === 0n) return [];

    const metadata = token.tokenMetadata ?? undefined;
    const decimals = metadata?.decimals;
    const usdPrice = token.tokenPrices?.find((price) => price.currency.toLowerCase() === "usd");

    return [
      {
        namespace: "eip155",
        chainId: chain.chainId,
        type: token.tokenAddress === null ? "native" : "erc20",
        tokenAddress: token.tokenAddress,
        rawBalance: token.tokenBalance,
        formattedBalance:
          decimals === undefined || decimals === null
            ? null
            : formatUnits(BigInt(token.tokenBalance), decimals),
        metadata: {
          name: nonEmptyOrNull(metadata?.name),
          symbol: nonEmptyOrNull(metadata?.symbol),
          decimals: decimals ?? null,
          logoUrl: nonEmptyOrNull(metadata?.logo),
        },
        usdPrice:
          usdPrice === undefined
            ? null
            : { value: usdPrice.value, updatedAt: usdPrice.lastUpdatedAt },
      },
    ];
  });

  const failedChainIds = new Set(
    response.error?.partialErrors.flatMap((failure) => {
      const chain = chainByAlchemyNetwork.get(failure.network as AlchemyChain);
      return chain === undefined ? [] : [chain.chainId];
    }) ?? [],
  );

  return yield* Schema.decodeUnknownEffect(ListWalletAssetsResponse)({
    items,
    nextCursor: nonEmptyOrNull(response.data.pageKey),
    partialFailures: Array.from(failedChainIds, (chainId) => ({
      chainId,
      code: "PROVIDER_UNAVAILABLE",
    })),
  }).pipe(
    Effect.mapError((cause) => new EvmPortfolioError({ code: "INVALID_PROVIDER_RESPONSE", cause })),
  );
});

export const makeAlchemyPortfolioService = (
  config: EvmConfigValues,
  httpClient: HttpClient.HttpClient,
): EvmPortfolioService => {
  const apiKey = encodeURIComponent(Redacted.value(config.alchemyApiKey));
  const client = HttpClient.filterStatusOk(httpClient);

  const getAssets = Effect.fn("evm.portfolio.getAssets")(function* (input: GetEvmPortfolioInput) {
    const request = HttpClientRequest.post(
      `https://api.g.alchemy.com/data/v1/${apiKey}/assets/tokens/by-address`,
    ).pipe(
      HttpClientRequest.bodyJsonUnsafe({
        addresses: [
          {
            address: input.address,
            networks: Object.values(chains).map((chain) => chain.alchemyChain),
          },
        ],
        withMetadata: true,
        withPrices: true,
        includeNativeTokens: true,
        includeErc20Tokens: true,
        ...(input.cursor === undefined ? {} : { pageKey: input.cursor }),
      }),
      HttpClientRequest.setHeader("accept", "application/json"),
    );

    const body = yield* client.execute(request).pipe(
      Effect.flatMap((response) => response.json),
      Effect.mapError((cause) => new EvmPortfolioError({ code: "PROVIDER_UNAVAILABLE", cause })),
    );
    const response = yield* Schema.decodeUnknownEffect(AlchemyPortfolioResponse)(body).pipe(
      Effect.mapError(
        (cause) => new EvmPortfolioError({ code: "INVALID_PROVIDER_RESPONSE", cause }),
      ),
    );

    return yield* normalizeAlchemyPortfolio(response);
  });

  return { getAssets };
};
