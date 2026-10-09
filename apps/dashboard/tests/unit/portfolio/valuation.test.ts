import { EthereumAddress } from "@namera-ai/protocol";
import type { PortfolioAsset } from "@namera-ai/protocol/dto";
import { expect, test } from "vitest";

import { summarizePortfolio } from "../../../src/components/assets-table/data";

const address = EthereumAddress.make("0x1111111111111111111111111111111111111111");
test("uses authoritative values and separates contracts sharing a symbol from unpriced assets", () => {
  const asset: PortfolioAsset = {
    namespace: "eip155",
    chainId: "eip155:1",
    type: "erc20",
    tokenAddress: address,
    rawBalance: "0x01",
    formattedBalance: "1",
    metadata: { name: "Token", symbol: "SAME", decimals: 0, logoUrl: null },
    usdPrice: null,
    valueUsd: "0.1",
  };
  const summary = summarizePortfolio(
    [
      asset,
      {
        ...asset,
        tokenAddress: EthereumAddress.make("0x2222222222222222222222222222222222222222"),
        valueUsd: "0.2",
      },
      { ...asset, chainId: "eip155:8453", valueUsd: null },
    ],
    address,
  );
  expect(summary.pricedTotalUsd).toBe(0.3);
  expect(summary.assetAllocations).toHaveLength(2);
  expect(summary.chainAllocations[0]?.value).toBe(0.3);
  expect(summary.unpricedAssetCount).toBe(1);
});
