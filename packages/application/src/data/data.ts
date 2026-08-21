import { Effect } from "effect";

import { makeAddressMetadataApplication } from "./address-metadata.js";
import type { AddressMetadataApplication } from "./address-metadata.js";
import { makePortfolioApplication } from "./portfolio.js";
import type { PortfolioApplication } from "./portfolio.js";

export interface DataApplication {
  readonly addressMetadata: AddressMetadataApplication;
  readonly portfolio: PortfolioApplication;
}

export const makeDataApplication = Effect.gen(function* () {
  const addressMetadata = yield* makeAddressMetadataApplication;
  const portfolio = yield* makePortfolioApplication(addressMetadata);
  return { addressMetadata, portfolio } satisfies DataApplication;
});
