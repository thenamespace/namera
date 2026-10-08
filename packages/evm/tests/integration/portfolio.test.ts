import { expect, it } from "@effect/vitest";
import { BigDecimal, Effect, Redacted } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";

import { EthereumAddress } from "@namera-ai/protocol";

import { makeAlchemyPortfolioService } from "../../src/portfolio/alchemy.js";

const config = {
  alchemyApiKey: Redacted.make("test-api-key"),
  alchemyBsoPolicyId: Redacted.make("test-policy-id"),
};
const address = EthereumAddress.make("0x1111111111111111111111111111111111111111");
const token = (overrides: Record<string, unknown> = {}) => ({
  network: "eth-mainnet",
  address,
  tokenAddress: "0x2222222222222222222222222222222222222222",
  tokenBalance: "0x2625a0",
  tokenMetadata: {
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
    logo: "https://example.test/usdc.svg",
  },
  tokenPrices: [
    { currency: "usd", value: "1.000000000000000001", lastUpdatedAt: "2026-10-09T00:00:00Z" },
  ],
  ...overrides,
});
const clientWith = (body: () => unknown) =>
  HttpClient.make((request) =>
    Effect.sync(() =>
      HttpClientResponse.fromWeb(
        request,
        new Response(JSON.stringify(body()), { headers: { "content-type": "application/json" } }),
      ),
    ),
  );

it.effect("paginates and deduplicates balances without rounding USD values", () =>
  Effect.gen(function* () {
    let calls = 0;
    const client = clientWith(() => ({
      data: {
        tokens: [
          token(),
          ...(calls > 0
            ? [
                token({
                  tokenAddress: null,
                  tokenBalance: "0xde0b6b3a7640000",
                  tokenMetadata: null,
                  tokenPrices: [],
                }),
              ]
            : []),
        ],
        pageKey: calls++ === 0 ? "next-page" : null,
      },
    }));
    const result = yield* makeAlchemyPortfolioService(config, client).getAssets({
      address,
      chainIds: ["eip155:1"],
    });
    expect(calls).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      formattedBalance: "2.5",
    });
    expect(
      BigDecimal.equals(
        BigDecimal.fromStringUnsafe(result.items[0]?.valueUsd ?? "0"),
        BigDecimal.fromStringUnsafe("2.5000000000000000025"),
      ),
    ).toBe(true);
    expect(result.items[1]).toMatchObject({
      formattedBalance: "1",
      metadata: { symbol: "ETH", decimals: 18 },
      valueUsd: null,
    });
  }),
);

it.effect("preserves unknown token balances and reports partial network errors", () =>
  Effect.gen(function* () {
    const client = clientWith(() => ({
      data: {
        tokens: [
          token({
            tokenMetadata: null,
            tokenPrices: [],
            error: { message: "metadata unavailable" },
          }),
        ],
      },
    }));
    const result = yield* makeAlchemyPortfolioService(config, client).getAssets({
      address,
      chainIds: ["eip155:1", "eip155:8453"],
    });
    expect(result.items[0]).toMatchObject({
      rawBalance: "0x2625a0",
      formattedBalance: null,
      valueUsd: null,
    });
    expect(result.partialFailures).toEqual([
      { chainId: "eip155:8453", code: "PROVIDER_UNAVAILABLE" },
    ]);
  }),
);

it.effect("rejects HTTP-200 partial errors rather than showing an empty wallet", () =>
  Effect.gen(function* () {
    const client = clientWith(() => ({
      data: { tokens: [] },
      error: { partialErrors: [{ network: "eth-mainnet", message: "Timed out" }] },
    }));
    const error = yield* Effect.flip(
      makeAlchemyPortfolioService(config, client).getAssets({ address, chainIds: ["eip155:1"] }),
    );
    expect(error.code).toBe("PROVIDER_UNAVAILABLE");
  }),
);

it.effect("stops repeated provider cursors instead of returning truncated totals", () =>
  Effect.gen(function* () {
    let calls = 0;
    const client = clientWith(() => {
      calls++;
      return { data: { tokens: [token()], pageKey: "repeat" } };
    });
    yield* Effect.flip(
      makeAlchemyPortfolioService(config, client).getAssets({ address, chainIds: ["eip155:1"] }),
    );
    expect(calls).toBe(2);
  }),
);

it.effect("sanitizes HTTP failures without exposing the credential URL", () =>
  Effect.gen(function* () {
    const client = HttpClient.make((request) =>
      Effect.succeed(
        HttpClientResponse.fromWeb(request, new Response("rate limited", { status: 429 })),
      ),
    );
    const error = yield* Effect.flip(
      makeAlchemyPortfolioService(config, client).getAssets({ address, chainIds: ["eip155:1"] }),
    );
    expect(error.code).toBe("PROVIDER_UNAVAILABLE");
    expect(String(error.cause)).not.toContain("test-api-key");
  }),
);
