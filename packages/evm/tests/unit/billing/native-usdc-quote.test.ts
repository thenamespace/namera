import { expect, it } from "@effect/vitest";
import { DateTime, Effect, Redacted } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";

import { makeNativeUsdcQuote } from "../../../src/billing/native-usdc-quote.js";

const lookup = (body: unknown, status = 200) => {
  const client = HttpClient.make((request) => {
    expect(request.urlParams).toContainEqual(["symbols", "ETH"]);
    expect(request.urlParams).toContainEqual(["symbols", "USDC"]);
    return Effect.succeed(
      HttpClientResponse.fromWeb(
        request,
        new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
  });
  return makeNativeUsdcQuote(Redacted.make("test-key"), client)();
};
const token = (symbol: string, value: string, lastUpdatedAt: string) => ({
  symbol,
  prices: [{ currency: "usd", value, lastUpdatedAt }],
});

it.effect("requests both symbols and retains the actual USDC price", () =>
  Effect.gen(function* () {
    const now = yield* DateTime.now;
    const updated = DateTime.formatIso(now);
    const quote = yield* lookup({
      data: [token("ETH", "3000", updated), token("USDC", "0.998", updated)],
    });
    expect(quote).toEqual({ ethUsd: 3000, usdcUsd: 0.998, quotedAt: now });
  }),
);

for (const value of ["0", "-1", "NaN", "Infinity", "not-a-price"]) {
  it.effect(`returns unavailable for invalid price ${value}`, () =>
    Effect.gen(function* () {
      const updated = DateTime.formatIso(yield* DateTime.now);
      expect(
        yield* lookup({ data: [token("ETH", value, updated), token("USDC", "1", updated)] }),
      ).toBeNull();
    }),
  );
}

it.effect("returns unavailable for missing, stale, future, erroneous and malformed quotes", () =>
  Effect.gen(function* () {
    const now = yield* DateTime.now;
    const updated = DateTime.formatIso(now);
    const eth = token("ETH", "3000", updated);
    expect(yield* lookup({ data: [eth] })).toBeNull();
    for (const offset of [-600_001, 60_001]) {
      const date = DateTime.formatIso(DateTime.makeUnsafe(DateTime.toEpochMillis(now) + offset));
      expect(yield* lookup({ data: [eth, token("USDC", "1", date)] })).toBeNull();
    }
    expect(
      yield* lookup({ data: [eth, { ...token("USDC", "1", updated), error: "Unavailable" }] }),
    ).toBeNull();
    expect(yield* lookup({ data: [eth, token("USDC", "1", "invalid")] })).toBeNull();
    expect(yield* lookup({ data: [] }, 429)).toBeNull();
    expect(yield* lookup({})).toBeNull();
  }),
);
