import { BigDecimal, DateTime, Effect, Option, Redacted, Schema } from "effect";
import { HttpClientRequest, type HttpClient } from "effect/http";

import { EthereumAddress, EvmPortfolioError, Hex } from "@namera-ai/protocol";
import type { PortfolioAsset } from "@namera-ai/protocol/dto";
import { formatUnits } from "viem";

import { chains, type ChainData } from "../chains/data.js";
import type { EvmConfigValues } from "../config.js";
import type { EvmPortfolioService } from "./types.js";

const nullableText = Schema.optional(Schema.NullOr(Schema.String));
const pageSchema = Schema.Struct({
  data: Schema.Struct({
    tokens: Schema.Array(
      Schema.Struct({
        network: Schema.String,
        address: EthereumAddress,
        tokenAddress: Schema.NullOr(EthereumAddress),
        tokenBalance: Hex,
        tokenMetadata: Schema.optional(
          Schema.NullOr(
            Schema.Struct({
              name: nullableText,
              symbol: nullableText,
              decimals: Schema.optional(
                Schema.NullOr(
                  Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 0, maximum: 255 }))),
                ),
              ),
              logo: nullableText,
            }),
          ),
        ),
        tokenPrices: Schema.optional(
          Schema.NullOr(
            Schema.Array(
              Schema.Struct({
                currency: Schema.String,
                value: Schema.String,
                lastUpdatedAt: Schema.String,
              }),
            ),
          ),
        ),
      }),
    ),
    pageKey: nullableText,
  }),
  error: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        partialErrors: Schema.optional(Schema.Array(Schema.Struct({ network: Schema.String }))),
      }),
    ),
  ),
});

const unavailable = () =>
  new EvmPortfolioError({
    code: "PROVIDER_UNAVAILABLE",
    cause: new Error("Alchemy portfolio unavailable"),
  });
const textOrNull = (value: string | null | undefined) => value?.trim() || null;

export const makeAlchemyPortfolioService = (
  config: EvmConfigValues,
  httpClient: HttpClient.HttpClient,
): EvmPortfolioService => {
  const readChain = Effect.fnUntraced(function* (address: EthereumAddress, chain: ChainData) {
    const assets = new Map<string, PortfolioAsset>();
    const cursors = new Set<string>();
    let pageKey: string | undefined;
    for (let page = 0; page < 100; page += 1) {
      const request = yield* HttpClientRequest.post(
        `https://api.g.alchemy.com/data/v1/${encodeURIComponent(Redacted.value(config.alchemyApiKey))}/assets/tokens/by-address`,
      ).pipe(
        HttpClientRequest.bodyJson({
          addresses: [{ address, networks: [chain.alchemyChain] }],
          withMetadata: true,
          withPrices: true,
          includeNativeTokens: true,
          includeErc20Tokens: true,
          ...(pageKey === undefined ? {} : { pageKey }),
        }),
      );
      const response = yield* httpClient.execute(request);
      if (response.status !== 200) return yield* unavailable();
      const body = yield* response.json.pipe(
        Effect.flatMap(Schema.decodeUnknownEffect(pageSchema)),
      );
      if (body.error?.partialErrors?.length) return yield* unavailable();
      for (const token of body.data.tokens) {
        if (
          token.network !== chain.alchemyChain ||
          token.address.toLowerCase() !== address.toLowerCase() ||
          !/^0x[\da-f]+$/i.test(token.tokenBalance)
        )
          return yield* unavailable();
        if (BigInt(token.tokenBalance) === 0n) continue;
        const native = token.tokenAddress === null;
        const decimals =
          token.tokenMetadata?.decimals ?? (native ? chain.chain.nativeCurrency.decimals : null);
        const formattedBalance =
          decimals === null ? null : formatUnits(BigInt(token.tokenBalance), decimals);
        const price = token.tokenPrices?.find((quote) => quote.currency.toLowerCase() === "usd");
        const decimal =
          price &&
          /^\d+(?:\.\d+)?(?:[eE][+-]?\d{1,3})?$/.test(price.value) &&
          price.value.length <= 64
            ? BigDecimal.fromString(price.value)
            : Option.none();
        const timestamp = price ? DateTime.make(price.lastUpdatedAt) : Option.none();
        const usdPrice =
          price && Option.isSome(decimal) && Option.isSome(timestamp)
            ? { value: price.value, updatedAt: timestamp.value }
            : null;
        const logo = textOrNull(token.tokenMetadata?.logo);
        const asset: PortfolioAsset = {
          namespace: "eip155",
          chainId: chain.chainId,
          type: native ? "native" : "erc20",
          tokenAddress:
            token.tokenAddress === null
              ? null
              : Schema.decodeUnknownSync(EthereumAddress)(token.tokenAddress.toLowerCase()),
          rawBalance: Hex.make(token.tokenBalance),
          formattedBalance,
          metadata: {
            name:
              textOrNull(token.tokenMetadata?.name) ??
              (native ? chain.chain.nativeCurrency.name : null),
            symbol:
              textOrNull(token.tokenMetadata?.symbol) ??
              (native ? chain.chain.nativeCurrency.symbol : null),
            decimals,
            logoUrl: logo?.startsWith("https://") ? logo : null,
          },
          usdPrice,
          valueUsd:
            formattedBalance !== null && usdPrice !== null
              ? BigDecimal.format(
                  BigDecimal.multiply(
                    BigDecimal.fromStringUnsafe(formattedBalance),
                    BigDecimal.fromStringUnsafe(usdPrice.value),
                  ),
                )
              : null,
        };
        assets.set(asset.tokenAddress ?? "native", asset);
      }
      const next = body.data.pageKey;
      if (!next) return [...assets.values()];
      if (cursors.has(next)) return yield* unavailable();
      cursors.add(next);
      pageKey = next;
    }
    return yield* unavailable();
  });

  return {
    getAssets: Effect.fn("evm.portfolio.getAssets")(function* ({ address, chainIds }) {
      const selected = Object.values(chains).filter(
        (chain) => !chainIds || chainIds.includes(chain.chainId),
      );
      const results = yield* Effect.forEach(
        selected,
        (chain) =>
          readChain(address, chain).pipe(
            Effect.timeout("30 seconds"),
            // Alchemy embeds the credential in its URL. Never export provider request traces/errors.
            Effect.withTracerEnabled(false),
            Effect.map((items) => ({ items, partialFailures: [] })),
            Effect.catch(() =>
              Effect.succeed({
                items: [],
                partialFailures: [
                  { chainId: chain.chainId, code: "PROVIDER_UNAVAILABLE" as const },
                ],
              }),
            ),
          ),
        { concurrency: 2 },
      );
      const items = results.flatMap((result) => result.items);
      const partialFailures = results.flatMap((result) => result.partialFailures);
      if (selected.length > 0 && partialFailures.length === selected.length)
        return yield* unavailable();
      return { items, partialFailures };
    }),
  };
};
