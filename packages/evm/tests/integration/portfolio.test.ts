import { expect, it } from "@effect/vitest";
import { Effect, Redacted } from "effect";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";

import { EthereumAddress } from "@namera-ai/protocol";

import { makeBlockscoutPortfolioService } from "../../src/portfolio/blockscout.js";

const config = {
  alchemyApiKey: Redacted.make("test-api-key"),
  alchemyBsoPolicyId: Redacted.make("test-policy-id"),
  blockscoutApiKey: Redacted.make("test-blockscout-key"),
};

const jsonResponse = (
  request: Parameters<Parameters<typeof HttpClient.make>[0]>[0],
  body: unknown,
) =>
  HttpClientResponse.fromWeb(
    request,
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );

it.effect("normalizes native and ERC-20 balances from Blockscout", () => {
  const client = HttpClient.make((request) => {
    if (request.url.includes("/tokens")) {
      return Effect.succeed(
        jsonResponse(request, {
          items: [
            {
              token: {
                address_hash: "0x2222222222222222222222222222222222222222",
                decimals: "6",
                exchange_rate: "1.00",
                icon_url: "https://example.test/usdc.svg",
                name: "USD Coin",
                reputation: "ok",
                symbol: "USDC",
                type: "ERC-20",
              },
              value: "2500000",
            },
          ],
          next_page_params: null,
        }),
      );
    }
    return Effect.succeed(
      jsonResponse(request, {
        coin_balance: "1000000000000000000",
        exchange_rate: "3200.50",
        hash: "0x1111111111111111111111111111111111111111",
        is_contract: false,
        is_scam: false,
        is_verified: false,
      }),
    );
  });
  const portfolio = makeBlockscoutPortfolioService(config, client);

  return Effect.gen(function* () {
    const result = yield* portfolio.getAssets({
      address: EthereumAddress.make("0x1111111111111111111111111111111111111111"),
      chainIds: ["eip155:1"],
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      chainId: "eip155:1",
      type: "native",
      formattedBalance: "1",
      metadata: { name: "Ether", symbol: "ETH", decimals: 18 },
      usdPrice: { value: "3200.50" },
    });
    expect(result.items[1]).toMatchObject({
      type: "erc20",
      formattedBalance: "2.5",
      metadata: { name: "USD Coin", symbol: "USDC", decimals: 6 },
    });
    expect(result.partialFailures).toEqual([]);
  });
});

it.effect("maps an unavailable Blockscout chain to a typed error", () => {
  const client = HttpClient.make((request) =>
    Effect.succeed(
      HttpClientResponse.fromWeb(request, new Response("rate limited", { status: 429 })),
    ),
  );
  const portfolio = makeBlockscoutPortfolioService(config, client);

  return Effect.flip(
    portfolio.getAssets({
      address: EthereumAddress.make("0x1111111111111111111111111111111111111111"),
      chainIds: ["eip155:1"],
    }),
  ).pipe(Effect.map((error) => expect(error.code).toBe("PROVIDER_UNAVAILABLE")));
});
