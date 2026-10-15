import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { Evm } from "@namera-ai/evm";
import { EthereumAddress, EvmPortfolioError } from "@namera-ai/protocol";

import { makePortfolioApplication } from "../../src/data/portfolio.js";

it.effect(
  "reuses account snapshots, isolates accounts, and refreshes explicitly or after expiry",
  () => {
    let calls = 0;
    const layer = Evm.testLayerWith({
      portfolio: {
        getAssets: () =>
          Effect.sync(() => {
            calls++;
            return { items: [], partialFailures: [] };
          }),
      },
    });
    return Effect.gen(function* () {
      const portfolio = yield* makePortfolioApplication();
      const request = {
        namespace: "eip155" as const,
        address: EthereumAddress.make("0x1111111111111111111111111111111111111111"),
      };
      const snapshots = yield* Effect.all([portfolio.query(request), portfolio.query(request)], {
        concurrency: 2,
      });
      expect(snapshots[0]).toEqual(snapshots[1]);
      expect(snapshots[0]).toMatchObject({
        address: request.address,
        items: [],
        summary: { assetCount: 0, totalValueUsd: "0" },
      });
      expect(calls).toBe(1);
      yield* portfolio.query({ ...request, refresh: true });
      yield* portfolio.query(request);
      expect(calls).toBe(2);
      yield* portfolio.query({
        ...request,
        address: EthereumAddress.make("0x2222222222222222222222222222222222222222"),
      });
      expect(calls).toBe(3);
      yield* TestClock.adjust("5 minutes");
      yield* portfolio.query(request);
      expect(calls).toBe(4);
    }).pipe(Effect.provide(layer));
  },
);

it.effect("does not cache a failed lookup or poison the next successful snapshot", () => {
  let calls = 0;
  const layer = Evm.testLayerWith({
    portfolio: {
      getAssets: () =>
        Effect.suspend(() => {
          calls++;
          return calls === 1
            ? Effect.fail(
                new EvmPortfolioError({
                  code: "PROVIDER_UNAVAILABLE",
                  cause: new Error("provider unavailable"),
                }),
              )
            : Effect.succeed({ items: [], partialFailures: [] });
        }),
    },
  });
  return Effect.gen(function* () {
    const portfolio = yield* makePortfolioApplication();
    const request = {
      namespace: "eip155" as const,
      address: EthereumAddress.make("0x1111111111111111111111111111111111111111"),
    };
    expect(yield* portfolio.query(request).pipe(Effect.flip)).toMatchObject({
      code: "PORTFOLIO_UNAVAILABLE",
    });
    expect((yield* portfolio.query(request)).items).toEqual([]);
    yield* portfolio.query(request);
    expect(calls).toBe(2);
  }).pipe(Effect.provide(layer));
});
