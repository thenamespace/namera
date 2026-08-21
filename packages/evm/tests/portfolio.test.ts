import { expect, it } from "@effect/vitest";
import { Effect, Predicate, Redacted } from "effect";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";

import { EthereumAddress } from "@namera-ai/protocol";

import { makeAlchemyPortfolioService } from "../src/portfolio/alchemy.js";

const config = {
  alchemyApiKey: Redacted.make("test-api-key"),
  alchemyBsoPolicyId: Redacted.make("test-policy-id"),
};

it.effect("normalizes enriched multi-chain assets and partial failures", () => {
  const client = HttpClient.make((request) => {
    if (!Predicate.isTagged(request.body, "Uint8Array")) {
      return Effect.die("Expected a JSON request body");
    }
    const body = JSON.parse(new TextDecoder().decode(request.body.body)) as {
      readonly addresses: ReadonlyArray<{ readonly networks: ReadonlyArray<string> }>;
    };
    expect(body.addresses[0]?.networks).toEqual([
      "arb-mainnet",
      "arb-sepolia",
      "base-mainnet",
      "base-sepolia",
      "eth-mainnet",
      "eth-sepolia",
      "opt-mainnet",
      "opt-sepolia",
    ]);

    return Effect.succeed(
      HttpClientResponse.fromWeb(
        request,
        new Response(
          JSON.stringify({
            data: {
              tokens: [
                {
                  address: "0x1111111111111111111111111111111111111111",
                  network: "eth-mainnet",
                  tokenAddress: null,
                  tokenBalance: "0x0de0b6b3a7640000",
                  tokenMetadata: {
                    decimals: 18,
                    logo: "https://static.alchemyapi.io/eth.png",
                    name: "Ethereum",
                    symbol: "ETH",
                  },
                  tokenPrices: [
                    {
                      currency: "usd",
                      value: "3200.50",
                      lastUpdatedAt: "2026-08-21T08:00:00Z",
                    },
                  ],
                },
                {
                  address: "0x1111111111111111111111111111111111111111",
                  network: "base-mainnet",
                  tokenAddress: "0x2222222222222222222222222222222222222222",
                  tokenBalance: "0x0",
                  tokenMetadata: {
                    decimals: 6,
                    logo: null,
                    name: "Zero token",
                    symbol: "ZERO",
                  },
                  tokenPrices: [],
                },
              ],
              pageKey: "next-page",
            },
            error: {
              message: "Failed to fetch tokens on certain networks",
              partialErrors: [{ network: "opt-mainnet", message: "Internal server error" }],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
  });
  const portfolio = makeAlchemyPortfolioService(config, client);

  return Effect.gen(function* () {
    const result = yield* portfolio.getAssets({
      address: EthereumAddress.make("0x1111111111111111111111111111111111111111"),
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      chainId: "eip155:1",
      type: "native",
      tokenAddress: null,
      rawBalance: "0x0de0b6b3a7640000",
      formattedBalance: "1",
      metadata: { name: "Ethereum", symbol: "ETH", decimals: 18 },
      usdPrice: { value: "3200.50" },
    });
    expect(result.nextCursor).toBe("next-page");
    expect(result.partialFailures).toEqual([
      { chainId: "eip155:10", code: "PROVIDER_UNAVAILABLE" },
    ]);
  });
});

it.effect("maps non-success provider responses to a typed availability error", () => {
  const client = HttpClient.make((request) =>
    Effect.succeed(
      HttpClientResponse.fromWeb(request, new Response("rate limited", { status: 429 })),
    ),
  );
  const portfolio = makeAlchemyPortfolioService(config, client);

  return Effect.flip(
    portfolio.getAssets({
      address: EthereumAddress.make("0x1111111111111111111111111111111111111111"),
    }),
  ).pipe(Effect.map((error) => expect(error.code).toBe("PROVIDER_UNAVAILABLE")));
});
