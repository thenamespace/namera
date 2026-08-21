import { DateTime, Effect, Redacted, Schema } from "effect";
import { HttpClientRequest, type HttpClient } from "effect/unstable/http";

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
          value: Schema.String,
          lastUpdatedAt: Schema.String,
        }),
      ),
      error: Schema.optional(Schema.NullOr(Schema.String)),
    }),
  ),
});

export const alchemySurchargeBasisPoints = 800;

export const makeEvmGasPrice = (config: EvmConfigValues, httpClient: HttpClient.HttpClient) =>
  Effect.fn("evm.billing.getGasPrice")(function* () {
    const apiKey = encodeURIComponent(Redacted.value(config.alchemyApiKey));
    const response = yield* httpClient
      .execute(
        HttpClientRequest.get(
          `https://api.g.alchemy.com/prices/v1/${apiKey}/tokens/by-symbol?symbols=ETH`,
        ).pipe(HttpClientRequest.setHeader("accept", "application/json")),
      )
      .pipe(
        Effect.flatMap((value) => value.json),
        Effect.flatMap(Schema.decodeUnknownEffect(alchemyPriceResponse)),
        Effect.mapError((cause) => new EvmExecutionError({ code: "PREPARATION_FAILED", cause })),
      );
    const eth = response.data.find((item) => item.symbol.toUpperCase() === "ETH");
    const usd = eth?.prices.find((item) => item.currency.toLowerCase() === "usd");
    if (usd === undefined) {
      return yield* new EvmExecutionError({
        code: "PREPARATION_FAILED",
        cause: new Error("Alchemy did not return an ETH/USD price"),
      });
    }

    return {
      provider: "alchemy",
      currency: "usd",
      nativeAsset: "ETH",
      nativePriceMicroUsd: decimalUsdToMicroUsd(usd.value),
      surchargeBasisPoints: alchemySurchargeBasisPoints,
      quotedAt: DateTime.makeUnsafe(usd.lastUpdatedAt),
    } satisfies EvmGasPriceQuote;
  });
