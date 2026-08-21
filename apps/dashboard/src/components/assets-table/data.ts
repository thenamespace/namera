import { getChainDataByCaip2 } from "@namera-ai/evm";
import type { EthereumAddress } from "@namera-ai/protocol";
import type { WalletAsset } from "@namera-ai/protocol/dto";

export const portfolioChartColors = [
  "var(--chart-3)",
  "var(--chart-2)",
  "var(--chart-4)",
  "var(--chart-1)",
  "var(--chart-5)",
] as const;

export type AssetTableRow = WalletAsset & {
  readonly id: string;
  readonly ownerAddress: EthereumAddress;
  readonly priceUsd: number | null;
  readonly valueUsd: number | null;
};

export type AssetAllocation = {
  readonly color: string;
  readonly id: string;
  readonly name: string;
  readonly value: number;
};

export type PortfolioSummary = {
  readonly assetAllocations: ReadonlyArray<AssetAllocation>;
  readonly chainAllocations: ReadonlyArray<AssetAllocation>;
  readonly pricedAssetCount: number;
  readonly pricedTotalUsd: number;
  readonly rows: ReadonlyArray<AssetTableRow>;
  readonly unpricedAssetCount: number;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency",
});
const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 2,
  notation: "compact",
  style: "currency",
});
const balanceFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 6,
});
const compactBalanceFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 3,
  notation: "compact",
});

const finiteNumber = (value: string | null): number | null => {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const formatUsd = (value: number): string =>
  Math.abs(value) >= 1_000_000
    ? compactCurrencyFormatter.format(value)
    : currencyFormatter.format(value);

export const formatUnitPrice = (value: number | null): string => {
  if (value === null) return "—";
  if (value > 0 && value < 0.01) return `<$0.01`;
  return formatUsd(value);
};

export const formatBalance = (value: string | null): string => {
  const parsed = finiteNumber(value);
  if (parsed === null) return "—";
  if (Math.abs(parsed) >= 1_000_000) return compactBalanceFormatter.format(parsed);
  return balanceFormatter.format(parsed);
};

export const getAssetName = (asset: WalletAsset): string =>
  asset.metadata.name ??
  asset.metadata.symbol ??
  (asset.type === "native" ? "Native token" : "Unknown token");

export const getAssetSymbol = (asset: WalletAsset): string =>
  asset.metadata.symbol ?? (asset.type === "native" ? "Native" : "Token");

export const getAssetExplorerUrl = (row: AssetTableRow): string | undefined => {
  const explorer = getChainDataByCaip2(row.chainId)?.chain.blockExplorers?.default.url?.replace(
    /\/$/,
    "",
  );
  if (explorer === undefined) return undefined;
  return row.tokenAddress === null
    ? `${explorer}/address/${row.ownerAddress}`
    : `${explorer}/token/${row.tokenAddress}`;
};

const collapseAllocations = (
  values: ReadonlyMap<string, { readonly name: string; readonly value: number }>,
): ReadonlyArray<AssetAllocation> => {
  const sorted = [...values.entries()]
    .map(([id, value]) => ({ id, name: value.name, value: value.value }))
    .filter((item) => item.value > 0)
    .toSorted((left, right) => right.value - left.value);
  const visible = sorted.slice(0, 4);
  const otherValue = sorted.slice(4).reduce((sum, item) => sum + item.value, 0);
  const collapsed =
    otherValue > 0 ? [...visible, { id: "other", name: "Other", value: otherValue }] : visible;

  return collapsed.map((item, index) => ({
    color: portfolioChartColors[index % portfolioChartColors.length] ?? "var(--chart-3)",
    id: item.id,
    name: item.name,
    value: item.value,
  }));
};

export const summarizePortfolio = (
  assets: ReadonlyArray<WalletAsset>,
  ownerAddress: EthereumAddress,
): PortfolioSummary => {
  const assetValues = new Map<string, { name: string; value: number }>();
  const chainValues = new Map<string, { name: string; value: number }>();

  const rows = assets.map((asset): AssetTableRow => {
    const balance = finiteNumber(asset.formattedBalance);
    const priceUsd = finiteNumber(asset.usdPrice?.value ?? null);
    const valueUsd = balance === null || priceUsd === null ? null : balance * priceUsd;
    const id = `${asset.chainId}:${asset.type}:${asset.tokenAddress ?? "native"}`;

    if (valueUsd !== null && Number.isFinite(valueUsd)) {
      const assetKey = asset.metadata.symbol ?? asset.tokenAddress ?? `native:${asset.chainId}`;
      const assetValue = assetValues.get(assetKey);
      assetValues.set(assetKey, {
        name: getAssetSymbol(asset),
        value: (assetValue?.value ?? 0) + valueUsd,
      });

      const chain = getChainDataByCaip2(asset.chainId);
      const chainValue = chainValues.get(asset.chainId);
      chainValues.set(asset.chainId, {
        name: chain?.chain.name ?? asset.chainId,
        value: (chainValue?.value ?? 0) + valueUsd,
      });
    }

    return {
      chainId: asset.chainId,
      formattedBalance: asset.formattedBalance,
      id,
      metadata: asset.metadata,
      namespace: asset.namespace,
      ownerAddress,
      priceUsd,
      rawBalance: asset.rawBalance,
      tokenAddress: asset.tokenAddress,
      type: asset.type,
      usdPrice: asset.usdPrice,
      valueUsd,
    };
  });
  const pricedAssetCount = rows.filter((row) => row.valueUsd !== null).length;

  return {
    assetAllocations: collapseAllocations(assetValues),
    chainAllocations: collapseAllocations(chainValues),
    pricedAssetCount,
    pricedTotalUsd: rows.reduce((sum, row) => sum + (row.valueUsd ?? 0), 0),
    rows,
    unpricedAssetCount: rows.length - pricedAssetCount,
  };
};
