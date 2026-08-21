import type { Effect } from "effect";

import type { EvmPortfolioError, EthereumAddress } from "@namera-ai/protocol";
import type { ListWalletAssetsResponse, WalletAssetCursor } from "@namera-ai/protocol/dto";

export interface GetEvmPortfolioInput {
  readonly address: EthereumAddress;
  readonly cursor?: WalletAssetCursor;
}

export type GetEvmPortfolio = (
  input: GetEvmPortfolioInput,
) => Effect.Effect<ListWalletAssetsResponse, EvmPortfolioError>;

export interface EvmPortfolioService {
  readonly getAssets: GetEvmPortfolio;
}
