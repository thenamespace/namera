import { DateTime, Effect, Redacted, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";

import { EvmExecutionError, type EvmGasPriceQuote } from "@namera-ai/protocol";

import type { EvmConfigValues } from "../config.js";
import { decimalUsdToMicroUsd } from "./money.js";

const alchemyPriceResponse = Schema.Struct({
  data: Schema.Array(
    Schema.Struct({
      symbol: Schema.String,
      prices: Schema.Array(
        Schema.Struct({
          currency: Schema.String,
          value: Schema.String.check(Schema.isMaxLength(64), Schema.isPattern(/^\d+(?:\.\d+)?$/)),
          lastUpdatedAt: Schema.DateTimeUtcFromString,
        }),
      ),
      error: Schema.optional(Schema.NullOr(Schema.String)),
    }),
  ),
});

export const alchemySurchargeBasisPoints = 800;

export const makeEvmGasPrice = (config: EvmConfigValues, httpClient: HttpClient.HttpClient) =>
  Effect.fn("evm.billing.getGasPrice")(
    function* () {
      const apiKey = encodeURIComponent(Redacted.value(config.alchemyApiKey));
      const response = yield* HttpClient.filterStatusOk(httpClient)
        .execute(
          HttpClientRequest.get(
            `https://api.g.alchemy.com/prices/v1/${apiKey}/tokens/by-symbol?symbols=ETH`,
          ).pipe(HttpClientRequest.setHeader("accept", "application/json")),
        )
        .pipe(
          Effect.flatMap((value) => value.json),
          Effect.flatMap(Schema.decodeUnknownEffect(alchemyPriceResponse)),
          Effect.timeout("5 seconds"),
        );
      const eth = response.data.find((item) => item.symbol.toUpperCase() === "ETH");
      const usd = eth?.prices.find((item) => item.currency.toLowerCase() === "usd");
      if (usd === undefined || (eth?.error !== undefined && eth.error !== null)) {
        return yield* new EvmExecutionError({
          code: "PREPARATION_FAILED",
          cause: new Error("Alchemy did not return an available ETH/USD price"),
        });
      }
      const now = DateTime.toEpochMillis(yield* DateTime.now);
      const timestamp = DateTime.toEpochMillis(usd.lastUpdatedAt);
      if (now - timestamp > 600_000 || timestamp > now + 60_000)
        return yield* new EvmExecutionError({
          code: "PREPARATION_FAILED",
          cause: new Error("Alchemy ETH/USD price is outside the freshness window"),
        });
      const nativePriceMicroUsd = yield* Effect.try(() => decimalUsdToMicroUsd(usd.value));
      if (nativePriceMicroUsd <= 0n)
        return yield* new EvmExecutionError({
          code: "PREPARATION_FAILED",
          cause: new Error("Alchemy ETH/USD price must be positive"),
        });

      return {
        provider: "alchemy",
        currency: "usd",
        nativeAsset: "ETH",
        nativePriceMicroUsd,
        surchargeBasisPoints: alchemySurchargeBasisPoints,
        quotedAt: usd.lastUpdatedAt,
      } satisfies EvmGasPriceQuote;
    },
    Effect.mapError((cause) =>
      cause instanceof EvmExecutionError
        ? cause
        : new EvmExecutionError({ code: "PREPARATION_FAILED", cause }),
    ),
  );
