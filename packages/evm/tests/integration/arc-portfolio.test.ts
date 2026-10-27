import { expect, it } from "@effect/vitest";
import { BigDecimal, Effect, Redacted } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";

import { EthereumAddress } from "@namera-ai/protocol";
import { toHex } from "viem";

import { makeAlchemyPortfolioService } from "../../src/portfolio/alchemy.js";

const address = EthereumAddress.make("0x1111111111111111111111111111111111111111");
const usdcAddress = "0x3600000000000000000000000000000000000000";
const config = { alchemyApiKey: Redacted.make("test"), alchemyBsoPolicyId: Redacted.make("test") };
const nativeBalance = 10_000_000_000_000_000_001n;
const token = (network: string, native: boolean) => ({
  network,
  address,
  tokenAddress: native ? null : usdcAddress,
  tokenBalance: toHex(native ? nativeBalance : 10_000_000n),
  tokenMetadata: { name: "USD Coin", symbol: "USDC", decimals: native ? 18 : 6 },
  tokenPrices: [{ currency: "usd", value: "1", lastUpdatedAt: "2026-10-27T00:00:00Z" }],
});

const portfolio = (tokens: ReadonlyArray<unknown>, rpcResult: unknown, indexerStatus = 200) =>
  makeAlchemyPortfolioService(
    config,
    HttpClient.make((request) => {
      const indexer = request.url.includes("/assets/tokens/by-address");
      return Effect.succeed(
        HttpClientResponse.fromWeb(
          request,
          Response.json(
            indexer ? { data: { tokens } } : { jsonrpc: "2.0", id: 1, result: rpcResult },
            { status: indexer ? indexerStatus : 200 },
          ),
        ),
      );
    }),
  );

for (const [chainId, network] of [
  ["eip155:5042", "arc-mainnet"],
  ["eip155:5042002", "arc-testnet"],
] as const) {
  it.effect(`counts native and ERC-20 USDC once on ${network}, preserving native dust`, () =>
    Effect.gen(function* () {
      const service = portfolio(
        [token(network, true), token(network, false)],
        toHex(nativeBalance),
      );
      const result = yield* service.getAssets({ address, chainIds: [chainId] });
      expect(result.partialFailures).toEqual([]);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        chainId,
        type: "native",
        tokenAddress: null,
        formattedBalance: "10.000000000000000001",
        metadata: { symbol: "USDC", decimals: 18 },
      });
      expect(
        BigDecimal.equals(
          BigDecimal.fromStringUnsafe(result.items[0]?.valueUsd ?? "0"),
          BigDecimal.fromStringUnsafe("10.000000000000000001"),
        ),
      ).toBe(true);
    }),
  );
}

it.effect("uses the exact native RPC balance when the indexer returns only the ERC-20 view", () =>
  Effect.gen(function* () {
    const result = yield* portfolio([token("arc-mainnet", false)], toHex(nativeBalance)).getAssets({
      address,
      chainIds: ["eip155:5042"],
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.formattedBalance).toBe("10.000000000000000001");
    expect(result.partialFailures).toEqual([]);
  }),
);

it.effect("retains other tokens without adding the USDC representations together", () =>
  Effect.gen(function* () {
    const otherToken = {
      ...token("arc-mainnet", false),
      tokenAddress: "0x2222222222222222222222222222222222222222",
    };
    const result = yield* portfolio(
      [token("arc-mainnet", false), otherToken],
      toHex(nativeBalance),
    ).getAssets({ address, chainIds: ["eip155:5042"] });
    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.tokenAddress).toBe(otherToken.tokenAddress);
  }),
);

it.effect(
  "falls back to native RPC with a partial failure when portfolio indexing is unavailable",
  () =>
    Effect.gen(function* () {
      const result = yield* portfolio([], toHex(nativeBalance), 503).getAssets({
        address,
        chainIds: ["eip155:5042"],
      });
      expect(result.items[0]).toMatchObject({
        formattedBalance: "10.000000000000000001",
        valueUsd: null,
      });
      expect(result.partialFailures).toEqual([
        { chainId: "eip155:5042", code: "PROVIDER_UNAVAILABLE" },
      ]);
    }),
);

it.effect("does not invent a balance or price when both providers fail", () =>
  Effect.gen(function* () {
    expect(
      yield* portfolio([], "0x", 503)
        .getAssets({ address, chainIds: ["eip155:5042"] })
        .pipe(Effect.flip),
    ).toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
  }),
);

it.effect(
  "keeps an available ERC-20 view partial when native RPC cannot verify its precision",
  () =>
    Effect.gen(function* () {
      const result = yield* portfolio([token("arc-mainnet", false)], "0x").getAssets({
        address,
        chainIds: ["eip155:5042"],
      });
      expect(result.items[0]).toMatchObject({ type: "erc20", formattedBalance: "10" });
      expect(result.partialFailures).toEqual([
        { chainId: "eip155:5042", code: "PROVIDER_UNAVAILABLE" },
      ]);
    }),
);

it.effect("returns a successful empty portfolio for a verified zero native balance", () =>
  Effect.gen(function* () {
    expect(yield* portfolio([], "0x0").getAssets({ address, chainIds: ["eip155:5042"] })).toEqual({
      items: [],
      partialFailures: [],
    });
  }),
);
