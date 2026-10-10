import { expect, it } from "@effect/vitest";
import { BigDecimal, Deferred, Effect, Predicate, Redacted, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";

import { EthereumAddress } from "@namera-ai/protocol";

import { chains } from "../../src/chains/data.js";
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

it.effect("fetches eight networks in two concurrent batches and follows each batch cursor", () =>
  Effect.gen(function* () {
    const started = yield* Deferred.make<void>();
    const requests: Array<{ networks: ReadonlyArray<string>; pageKey: string | undefined }> = [];
    const requestSchema = Schema.Struct({
      addresses: Schema.Tuple([
        Schema.Struct({ address: EthereumAddress, networks: Schema.Array(Schema.String) }),
      ]),
      pageKey: Schema.optional(Schema.String),
    });
    const client = HttpClient.make((request) =>
      Effect.gen(function* () {
        if (!Predicate.isTagged(request.body, "Uint8Array"))
          return yield* Effect.die("Expected JSON body");
        const body = Schema.decodeUnknownSync(Schema.fromJsonString(requestSchema))(
          new TextDecoder().decode(request.body.body),
        );
        const networks = body.addresses[0].networks;
        expect(body.addresses[0].address).toBe(address);
        requests.push({ networks, pageKey: body.pageKey });
        if (requests.length === 2) yield* Deferred.succeed(started, undefined);
        yield* Deferred.await(started);
        return HttpClientResponse.fromWeb(
          request,
          new Response(
            JSON.stringify({
              data: {
                tokens: networks.flatMap((network) => [
                  token({ network }),
                  token({ network, tokenAddress: null }),
                ]),
                pageKey: body.pageKey ? null : networks[0],
              },
            }),
          ),
        );
      }),
    );
    const result = yield* makeAlchemyPortfolioService(config, client).getAssets({ address });
    const initial = requests.filter((request) => request.pageKey === undefined);
    expect(initial.map((request) => request.networks.length)).toEqual([4, 4]);
    expect(initial.flatMap((request) => request.networks).toSorted()).toEqual(
      Object.values(chains)
        .map((chain) => chain.alchemyChain)
        .toSorted(),
    );
    expect(requests).toHaveLength(4);
    for (const request of requests.filter((entry) => entry.pageKey !== undefined)) {
      expect(request.networks).toEqual(
        initial.find((batch) => batch.networks[0] === request.pageKey)?.networks,
      );
    }
    expect(result.items).toHaveLength(16);
    expect(result.partialFailures).toEqual([]);
  }),
);

it.effect("discards earlier balances for a network that fails on a later page", () =>
  Effect.gen(function* () {
    let calls = 0;
    const client = clientWith(() =>
      ++calls === 1
        ? {
            data: { tokens: [token(), token({ network: "base-mainnet" })], pageKey: "next" },
          }
        : {
            data: { tokens: [] },
            error: { partialErrors: [{ network: "base-mainnet" }, { network: "base-mainnet" }] },
          },
    );
    const result = yield* makeAlchemyPortfolioService(config, client).getAssets({
      address,
      chainIds: ["eip155:1", "eip155:8453"],
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.chainId).toBe("eip155:1");
    expect(result.partialFailures).toEqual([
      { chainId: "eip155:8453", code: "PROVIDER_UNAVAILABLE" },
    ]);
  }),
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
      error: { partialErrors: [{ network: "base-mainnet" }] },
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

it.effect("keeps the successful batch when the other request fails", () =>
  Effect.gen(function* () {
    let calls = 0;
    const client = HttpClient.make((request) =>
      Effect.sync(() => {
        const failed = calls++ === 0;
        return HttpClientResponse.fromWeb(
          request,
          new Response(failed ? "rate limited" : JSON.stringify({ data: { tokens: [] } }), {
            status: failed ? 429 : 200,
          }),
        );
      }),
    );
    const result = yield* makeAlchemyPortfolioService(config, client).getAssets({ address });
    expect(calls).toBe(2);
    expect(result.items).toEqual([]);
    expect(result.partialFailures).toEqual(
      Object.values(chains)
        .slice(0, 4)
        .map((chain) => ({
          chainId: chain.chainId,
          code: "PROVIDER_UNAVAILABLE",
        })),
    );
  }),
);
