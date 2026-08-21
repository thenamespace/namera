import type { Effect } from "effect";

import type { EvmPortfolioError, EthereumAddress, SupportedEvmChainId } from "@namera-ai/protocol";
import type { PortfolioAsset, PortfolioPartialFailure } from "@namera-ai/protocol/dto";

export interface GetEvmPortfolioInput {
  readonly address: EthereumAddress;
  readonly chainIds?: ReadonlyArray<SupportedEvmChainId>;
}

export interface EvmPortfolioSnapshot {
  readonly items: ReadonlyArray<PortfolioAsset>;
  readonly partialFailures: ReadonlyArray<PortfolioPartialFailure>;
}

export type GetEvmPortfolio = (
  input: GetEvmPortfolioInput,
) => Effect.Effect<EvmPortfolioSnapshot, EvmPortfolioError>;

export interface EvmPortfolioService {
  readonly getAssets: GetEvmPortfolio;
}
