import { BigDecimal, Cache, Effect, Exit, Schema } from "effect";

import { Evm } from "@namera-ai/evm";
import { PortfolioUnavailableError } from "@namera-ai/protocol";
import {
  type PortfolioAsset,
  type PortfolioResponse,
  QueryPortfolioRequest,
} from "@namera-ai/protocol/dto";

import { decodePortfolioCursor, encodePortfolioCursor } from "./pagination.js";

const valueUsd = (asset: PortfolioAsset) => BigDecimal.fromStringUnsafe(asset.valueUsd ?? "0");
const totalUsd = (assets: ReadonlyArray<PortfolioAsset>) =>
  BigDecimal.format(BigDecimal.sumAll(assets.map(valueUsd)));

export interface PortfolioApplication {
  readonly query: (
    request: QueryPortfolioRequest,
  ) => Effect.Effect<PortfolioResponse, PortfolioUnavailableError>;
}

export const makePortfolioApplication = Effect.fn("application.portfolio.make")(function* () {
  const evm = yield* Evm;

  const snapshots = yield* Cache.makeWith(
    (key: string) =>
      Effect.gen(function* () {
        const request = Schema.decodeUnknownSync(QueryPortfolioRequest)(JSON.parse(key));
        return yield* evm.portfolio
          .getAssets({
            address: request.address,
            ...(request.chainIds === undefined ? {} : { chainIds: request.chainIds }),
          })
          .pipe(
            Effect.mapError(() => new PortfolioUnavailableError({ code: "PORTFOLIO_UNAVAILABLE" })),
          );
      }),
    { capacity: 500, timeToLive: (exit) => (Exit.isSuccess(exit) ? "5 minutes" : "0 seconds") },
  );

  const query = Effect.fn("application.portfolio.query")(function* (
    request: QueryPortfolioRequest,
  ) {
    const key = JSON.stringify({
      namespace: request.namespace,
      address: request.address.toLowerCase(),
      ...(request.chainIds === undefined
        ? {}
        : { chainIds: [...new Set(request.chainIds)].toSorted() }),
    });
    // Cache complete snapshots so subsequent pages use the same balances and ordering.
    const snapshot = yield* request.refresh === true && request.cursor === undefined
      ? Cache.refresh(snapshots, key)
      : Cache.get(snapshots, key);
    const allItems = snapshot.items.toSorted((left, right) =>
      BigDecimal.Order(valueUsd(right), valueUsd(left)),
    );
    const chainIds = Array.from(new Set(allItems.map((item) => item.chainId)));
    const chains = chainIds.map((chainId) => {
      const items = allItems.filter((item) => item.chainId === chainId);
      const priced = items.filter((item) => item.valueUsd !== null);
      return {
        chainId,
        assetCount: items.length,
        pricedAssetCount: priced.length,
        totalValueUsd: totalUsd(items),
      };
    });
    const offset = decodePortfolioCursor(request.cursor);
    const pageSize = request.pageSize ?? 50;
    const nextOffset = offset + pageSize;
    return {
      namespace: "eip155",
      address: request.address,
      summary: {
        assetCount: allItems.length,
        pricedAssetCount: allItems.filter((item) => item.valueUsd !== null).length,
        unpricedAssetCount: allItems.filter((item) => item.valueUsd === null).length,
        totalValueUsd: totalUsd(allItems),
      },
      chains,
      items: allItems.slice(offset, nextOffset),
      nextCursor: nextOffset < allItems.length ? encodePortfolioCursor(nextOffset) : null,
      partialFailures: snapshot.partialFailures,
    } satisfies PortfolioResponse;
  });

  return { query } satisfies PortfolioApplication;
});
