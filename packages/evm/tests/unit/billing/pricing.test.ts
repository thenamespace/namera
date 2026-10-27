import { expect, it } from "@effect/vitest";
import { DateTime, Effect, Fiber, Redacted } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import { TestClock } from "effect/testing";

import { makeEvmGasPrice } from "../../../src/billing/pricing.js";
import { chains } from "../../../src/chains/data.js";

const config = {
  alchemyApiKey: Redacted.make("test-key"),
  alchemyBsoPolicyId: Redacted.make("test-policy"),
};
const body = (
  value = "3000.1234561",
  lastUpdatedAt = "1970-01-01T00:00:00.000Z",
  error: string | null = null,
) => ({
  data: [{ symbol: "ETH", error, prices: [{ currency: "usd", value, lastUpdatedAt }] }],
});
const lookup = (response: unknown, status = 200) =>
  makeEvmGasPrice(
    config,
    HttpClient.make((request) =>
      Effect.succeed(
        HttpClientResponse.fromWeb(
          request,
          new Response(JSON.stringify(response), {
            status,
            headers: { "content-type": "application/json" },
          }),
        ),
      ),
    ),
  )(chains["ethereum-mainnet"]);

it.effect("accepts a fresh positive quote and rounds upward without floating point", () =>
  Effect.gen(function* () {
    const quote = yield* lookup(body());
    expect(quote.nativePriceMicroUsd).toBe(3_000_123_457n);
    expect(quote.quotedAt).toEqual(yield* DateTime.now);
    expect((yield* lookup(body("0.0000001"))).nativePriceMicroUsd).toBe(1n);
  }),
);

for (const value of ["0", "0.000", "-1", "NaN", "Infinity", "1e3", "1.2.3", "9".repeat(65)]) {
  it.effect(`rejects invalid financial price ${value.slice(0, 20)}`, () =>
    Effect.gen(function* () {
      expect(yield* lookup(body(value)).pipe(Effect.flip)).toMatchObject({
        code: "PREPARATION_FAILED",
      });
    }),
  );
}

it.effect("rejects stale, future, malformed, missing and provider-error quotes", () =>
  Effect.gen(function* () {
    yield* TestClock.setTime(1_000_000);
    const now = DateTime.toEpochMillis(yield* DateTime.now);
    const timestamp = (offset: number) => DateTime.formatIso(DateTime.makeUnsafe(now + offset));
    for (const offset of [-600_001, 60_001])
      expect(yield* lookup(body("3000", timestamp(offset))).pipe(Effect.flip)).toMatchObject({
        code: "PREPARATION_FAILED",
      });
    for (const offset of [-600_000, 60_000])
      expect((yield* lookup(body("3000", timestamp(offset)))).nativePriceMicroUsd).toBe(
        3_000_000_000n,
      );
    for (const response of [
      body("3000", "invalid"),
      body("3000", timestamp(0), "Unavailable"),
      body("3000", timestamp(0), ""),
      { data: [] },
      {},
    ])
      expect(yield* lookup(response).pipe(Effect.flip)).toMatchObject({
        code: "PREPARATION_FAILED",
      });
    for (const status of [429, 503])
      expect(yield* lookup(body("3000", timestamp(0)), status).pipe(Effect.flip)).toMatchObject({
        code: "PREPARATION_FAILED",
      });
  }),
);

it.effect("bounds unresponsive quote requests with a typed failure", () =>
  Effect.gen(function* () {
    const fiber = yield* makeEvmGasPrice(
      config,
      HttpClient.make(() => Effect.never),
    )(chains["ethereum-mainnet"]).pipe(Effect.flip, Effect.forkChild);
    yield* TestClock.adjust("5 seconds");
    expect(yield* Fiber.join(fiber)).toMatchObject({ code: "PREPARATION_FAILED" });
  }),
);

it.effect("uses USDC/USD for Arc and rejects an ETH quote for that network", () =>
  Effect.gen(function* () {
    const requests: string[] = [];
    const price = makeEvmGasPrice(
      config,
      HttpClient.make((request) => {
        requests.push(request.url);
        return Effect.succeed(
          HttpClientResponse.fromWeb(
            request,
            new Response(
              JSON.stringify({
                data: [
                  ...body("3000").data,
                  {
                    symbol: "USDC",
                    prices: [
                      {
                        currency: "usd",
                        value: "0.9999991",
                        lastUpdatedAt: "1970-01-01T00:00:00.000Z",
                      },
                    ],
                  },
                ],
              }),
            ),
          ),
        );
      }),
    );
    const quote = yield* price(chains["arc-mainnet"]);
    expect(quote).toMatchObject({ nativeAsset: "USDC", nativePriceMicroUsd: 1_000_000n });
    expect(requests[0]).toContain("symbols=USDC");

    const missing = makeEvmGasPrice(
      config,
      HttpClient.make((request) =>
        Effect.succeed(HttpClientResponse.fromWeb(request, new Response(JSON.stringify(body())))),
      ),
    );
    expect(yield* missing(chains["arc-mainnet"]).pipe(Effect.flip)).toMatchObject({
      code: "PREPARATION_FAILED",
    });
  }),
);
