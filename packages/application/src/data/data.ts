import { Effect } from "effect";

import { makePortfolioApplication } from "./portfolio.js";
import type { PortfolioApplication } from "./portfolio.js";

export interface DataApplication {
  readonly portfolio: PortfolioApplication;
}

export const makeDataApplication = Effect.gen(function* () {
  const portfolio = yield* makePortfolioApplication();
  return { portfolio } satisfies DataApplication;
});
