import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { Evm } from "@namera-ai/evm";
import { EthereumAddress } from "@namera-ai/protocol";

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
      yield* Effect.all([portfolio.query(request), portfolio.query(request)], { concurrency: 2 });
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
