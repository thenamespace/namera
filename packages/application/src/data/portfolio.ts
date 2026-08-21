import { Effect } from "effect";

import { Evm } from "@namera-ai/evm";
import { PortfolioUnavailableError } from "@namera-ai/protocol";
import type {
  PortfolioAsset,
  PortfolioResponse,
  QueryPortfolioRequest,
} from "@namera-ai/protocol/dto";

import type { AddressMetadataApplication } from "./address-metadata.js";
import { decodePortfolioCursor, encodePortfolioCursor } from "./pagination.js";

const valueUsd = (asset: PortfolioAsset): number => {
  const balance = Number(asset.formattedBalance ?? "0");
  const price = Number(asset.usdPrice?.value ?? "0");
  const value = balance * price;
  return Number.isFinite(value) ? value : 0;
};

const decimal = (value: number): string =>
  value.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 8 });

export interface PortfolioApplication {
  readonly query: (
    request: QueryPortfolioRequest,
  ) => Effect.Effect<PortfolioResponse, PortfolioUnavailableError>;
}

export const makePortfolioApplication = Effect.fn("application.portfolio.make")(function* (
  addressMetadata: AddressMetadataApplication,
) {
  const evm = yield* Evm;

  const query = Effect.fn("application.portfolio.query")(function* (
    request: QueryPortfolioRequest,
  ) {
    const snapshot = yield* evm.portfolio
      .getAssets({
        address: request.address,
        ...(request.chainIds === undefined ? {} : { chainIds: request.chainIds }),
      })
      .pipe(
        Effect.mapError(() => new PortfolioUnavailableError({ code: "PORTFOLIO_UNAVAILABLE" })),
      );
    const metadata = yield* addressMetadata
      .store(
        snapshot.items.flatMap((asset) =>
          asset.addressMetadata === null ? [] : [asset.addressMetadata],
        ),
      )
      .pipe(Effect.catch(() => Effect.succeed([])));
    const metadataByKey = new Map(
      metadata.map((item) => [`${item.chainId}:${item.address.toLowerCase()}`, item]),
    );
    const allItems = snapshot.items
      .map((asset) => ({
        ...asset,
        addressMetadata:
          asset.tokenAddress === null
            ? null
            : (metadataByKey.get(`${asset.chainId}:${asset.tokenAddress.toLowerCase()}`) ?? null),
      }))
      .filter((asset) => asset.addressMetadata?.trust.isScam !== true)
      .toSorted((left, right) => valueUsd(right) - valueUsd(left));
    const chainIds = Array.from(new Set(allItems.map((item) => item.chainId)));
    const chains = chainIds.map((chainId) => {
      const items = allItems.filter((item) => item.chainId === chainId);
      const priced = items.filter((item) => item.usdPrice !== null);
      return {
        chainId,
        assetCount: items.length,
        pricedAssetCount: priced.length,
        totalValueUsd: decimal(items.reduce((total, item) => total + valueUsd(item), 0)),
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
        pricedAssetCount: allItems.filter((item) => item.usdPrice !== null).length,
        unpricedAssetCount: allItems.filter((item) => item.usdPrice === null).length,
        totalValueUsd: decimal(allItems.reduce((total, item) => total + valueUsd(item), 0)),
      },
      chains,
      items: allItems.slice(offset, nextOffset),
      nextCursor: nextOffset < allItems.length ? encodePortfolioCursor(nextOffset) : null,
      partialFailures: snapshot.partialFailures,
    } satisfies PortfolioResponse;
  });

  return { query } satisfies PortfolioApplication;
});
