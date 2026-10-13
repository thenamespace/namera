import { DateTime, Effect, Redacted, Schema } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";

import type { EvmNativePriceQuote } from "@namera-ai/protocol/dto";

const responseSchema = Schema.Struct({
  data: Schema.Array(
    Schema.Struct({
      symbol: Schema.String,
      prices: Schema.Array(
        Schema.Struct({
          currency: Schema.String,
          value: Schema.NumberFromString.check(Schema.isFinite(), Schema.isGreaterThan(0)),
          lastUpdatedAt: Schema.DateTimeUtcFromString,
        }),
      ),
      error: Schema.optionalKey(Schema.NullOr(Schema.String)),
    }),
  ),
});

/** Informational only: unavailable or stale quotes never block owner approval. */
export const makeNativeUsdcQuote = (
  apiKey: Redacted.Redacted<string>,
  httpClient: HttpClient.HttpClient,
) =>
  Effect.fnUntraced(function* (): Effect.fn.Return<EvmNativePriceQuote | null> {
    const response = yield* HttpClient.filterStatusOk(httpClient)
      .execute(
        HttpClientRequest.get(
          `https://api.g.alchemy.com/prices/v1/${encodeURIComponent(Redacted.value(apiKey))}/tokens/by-symbol`,
        ).pipe(
          HttpClientRequest.setUrlParams({ symbols: ["ETH", "USDC"] }),
          HttpClientRequest.acceptJson,
        ),
      )
      .pipe(
        Effect.flatMap(HttpClientResponse.schemaBodyJson(responseSchema)),
        Effect.timeout("5 seconds"),
        Effect.catch(() => Effect.succeed(null)),
      );
    if (!response) return null;

    const price = (symbol: string) =>
      response.data
        .find((token) => token.symbol === symbol && !token.error)
        ?.prices.find((quote) => quote.currency.toLowerCase() === "usd");
    const eth = price("ETH");
    const usdc = price("USDC");
    if (!eth || !usdc) return null;

    const now = DateTime.toEpochMillis(yield* DateTime.now);
    const timestamps = [eth.lastUpdatedAt, usdc.lastUpdatedAt].map(DateTime.toEpochMillis);
    if (timestamps.some((time) => now - time > 600_000 || time > now + 60_000)) return null;
    return {
      ethUsd: eth.value,
      usdcUsd: usdc.value,
      quotedAt: DateTime.makeUnsafe(Math.min(...timestamps)),
    };
  });
