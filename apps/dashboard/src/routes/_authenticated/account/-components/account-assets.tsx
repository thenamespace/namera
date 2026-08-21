import { useMemo } from "react";

import type { PortfolioResponse, WalletResponse } from "@namera-ai/protocol/dto";
import { Card, ChartTooltip, PieChart, Tooltip, Typography } from "@namera-ai/ui";

import { AssetsTable, summarizePortfolio, type AssetAllocation } from "@/components/assets-table";
import { ChainDisplay } from "@/components/display";
import { useWalletPortfolio } from "@/hooks/wallet";

type PieTooltipProps = {
  readonly active?: boolean;
  readonly payload?: ReadonlyArray<{
    readonly name?: string;
    readonly payload?: { readonly color?: string };
    readonly value?: number | string;
  }>;
};

const currency = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency",
});
const percent = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, style: "percent" });

function PortfolioPieTooltip({ active, payload }: PieTooltipProps) {
  const item = payload?.[0];
  if (active !== true || item === undefined) return null;

  return (
    <ChartTooltip>
      <ChartTooltip.Item>
        <ChartTooltip.Indicator color={item.payload?.color ?? "var(--chart-3)"} />
        <ChartTooltip.Label>{item.name}</ChartTooltip.Label>
        <ChartTooltip.Value>{currency.format(Number(item.value ?? 0))}</ChartTooltip.Value>
      </ChartTooltip.Item>
    </ChartTooltip>
  );
}

const portfolioPieTooltip = <PortfolioPieTooltip />;

function AllocationDot({ color }: { readonly color: string }) {
  const style = useMemo(() => ({ backgroundColor: color }), [color]);
  return <span className="size-2 shrink-0 rounded-full" style={style} />;
}

function AllocationSegment({
  item,
  total,
}: {
  readonly item: AssetAllocation;
  readonly total: number;
}) {
  const style = useMemo(
    () => ({ backgroundColor: item.color, width: `${(item.value / total) * 100}%` }),
    [item.color, item.value, total],
  );

  return (
    <Tooltip delay={150}>
      <Tooltip.Trigger
        aria-label={`${item.name}: ${currency.format(item.value)}`}
        className="h-full min-w-1 outline-none ring-inset focus-visible:ring-2 focus-visible:ring-foreground"
        style={style}
        tabIndex={0}
      />
      <Tooltip.Content showArrow>
        <Tooltip.Arrow />
        <div className="grid gap-0.5">
          <span>{item.name}</span>
          <span className="tabular-nums text-muted">{currency.format(item.value)}</span>
        </div>
      </Tooltip.Content>
    </Tooltip>
  );
}

function AllocationLegend({
  allocations,
  total,
}: {
  allocations: ReadonlyArray<AssetAllocation>;
  total: number;
}) {
  return (
    <div className="grid gap-2">
      {allocations.map((item) => (
        <div className="flex min-w-0 items-center gap-2" key={item.id}>
          <AllocationDot color={item.color} />
          <span className="min-w-0 flex-1 truncate text-xs text-muted">{item.name}</span>
          <span className="text-xs tabular-nums text-foreground">
            {total === 0 ? "0%" : percent.format(item.value / total)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChainAllocation({
  allocations,
  total,
}: {
  allocations: ReadonlyArray<AssetAllocation>;
  total: number;
}) {
  if (allocations.length === 0 || total === 0) {
    return <div className="h-2 rounded-full bg-secondary" />;
  }

  return (
    <figure
      className="flex h-2.5 overflow-hidden rounded-full bg-secondary"
      aria-label="Portfolio value by chain"
    >
      {allocations.map((item) => (
        <AllocationSegment item={item} key={item.id} total={total} />
      ))}
    </figure>
  );
}

function PortfolioOverview({
  account,
  portfolio,
}: {
  account: WalletResponse;
  portfolio: PortfolioResponse;
}) {
  const summary = useMemo(
    () => summarizePortfolio(portfolio.items, account.address),
    [account.address, portfolio.items],
  );
  const networkCount = new Set(portfolio.items.map((asset) => asset.chainId)).size;
  const coverage = summary.rows.length === 0 ? 0 : summary.pricedAssetCount / summary.rows.length;
  const enrichedCount = portfolio.items.filter((asset) => asset.addressMetadata !== null).length;

  return (
    <section
      aria-labelledby="portfolio-overview"
      className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.8fr)]"
    >
      <Card className="overflow-hidden rounded-xl border shadow-sm">
        <Card.Content className="grid min-h-60 gap-6 p-5">
          <div>
            <Typography className="text-sm!" color="muted">
              Total portfolio value
            </Typography>
            <Typography.Heading
              className="mt-2 text-4xl tracking-tight tabular-nums"
              id="portfolio-overview"
              level={2}
            >
              {currency.format(summary.pricedTotalUsd)}
            </Typography.Heading>
            <Typography className="mt-2 text-xs!" color="muted">
              Based on {summary.pricedAssetCount} priced{" "}
              {summary.pricedAssetCount === 1 ? "asset" : "assets"} across supported networks
            </Typography>
          </div>

          <div className="self-end">
            <div className="mb-3 flex items-center justify-between gap-4">
              <Typography className="text-sm!" weight="medium">
                Chain allocation
              </Typography>
              <Typography className="text-xs!" color="muted">
                Live balances
              </Typography>
            </div>
            <ChainAllocation
              allocations={summary.chainAllocations}
              total={summary.pricedTotalUsd}
            />
            <div className="mt-4 grid gap-x-5 gap-y-2 sm:grid-cols-2">
              {summary.chainAllocations.map((item) => {
                const chainId = summary.rows.find((row) => row.chainId === item.id)?.chainId;
                return (
                  <div className="flex min-w-0 items-center gap-2" key={item.id}>
                    <AllocationDot color={item.color} />
                    <div className="min-w-0 flex-1">
                      {chainId === undefined ? (
                        <span className="text-xs">{item.name}</span>
                      ) : (
                        <ChainDisplay chainId={chainId} />
                      )}
                    </div>
                    <span className="text-xs tabular-nums text-muted">
                      {summary.pricedTotalUsd === 0
                        ? "0%"
                        : percent.format(item.value / summary.pricedTotalUsd)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 border-t pt-4">
            <div>
              <div className="text-sm font-medium tabular-nums">{summary.rows.length}</div>
              <div className="mt-0.5 text-xs text-muted">Assets</div>
            </div>
            <div>
              <div className="text-sm font-medium tabular-nums">{networkCount}</div>
              <div className="mt-0.5 text-xs text-muted">Networks</div>
            </div>
            <div>
              <div className="text-sm font-medium tabular-nums">{percent.format(coverage)}</div>
              <div className="mt-0.5 text-xs text-muted">Price coverage</div>
            </div>
            <div>
              <div className="text-sm font-medium tabular-nums">{enrichedCount}</div>
              <div className="mt-0.5 text-xs text-muted">Enriched</div>
            </div>
          </div>
        </Card.Content>
      </Card>

      <Card className="rounded-xl border shadow-sm">
        <Card.Header className="pb-0">
          <Card.Title className="text-sm">Asset allocation</Card.Title>
          <Card.Description className="text-xs">Share of priced portfolio value</Card.Description>
        </Card.Header>
        <Card.Content className="grid grid-cols-[10rem_minmax(0,1fr)] items-center gap-5 p-5 pt-2 lg:grid-cols-1">
          <div className="relative mx-auto size-40">
            {summary.assetAllocations.length === 0 ? (
              <div className="absolute inset-3 rounded-full border-12 border-secondary" />
            ) : (
              <PieChart height={160} width={160}>
                <PieChart.Pie
                  cornerRadius={10}
                  cx="50%"
                  cy="50%"
                  data={summary.assetAllocations}
                  dataKey="value"
                  innerRadius="70%"
                  nameKey="name"
                  outerRadius="94%"
                  paddingAngle={-16}
                  strokeWidth={0}
                >
                  {summary.assetAllocations.map((item) => (
                    <PieChart.Cell fill={item.color} key={item.id} />
                  ))}
                </PieChart.Pie>
                <PieChart.Tooltip content={portfolioPieTooltip} />
              </PieChart>
            )}
            <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
              <span className="text-lg font-semibold tabular-nums">{summary.pricedAssetCount}</span>
              <span className="text-[11px] text-muted">priced assets</span>
            </div>
          </div>
          <AllocationLegend allocations={summary.assetAllocations} total={summary.pricedTotalUsd} />
        </Card.Content>
      </Card>
    </section>
  );
}

type AccountAssetsProps = {
  readonly account: WalletResponse;
  readonly initialPortfolio: PortfolioResponse;
};

export function AccountAssets({ account, initialPortfolio }: AccountAssetsProps) {
  const assets = useWalletPortfolio(account.id);
  const portfolio = assets.data ?? initialPortfolio;

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-7 py-2 sm:px-2 sm:py-5">
      <header>
        <Typography.Heading className="text-2xl tracking-tight" level={2}>
          Assets
        </Typography.Heading>
        <Typography.Paragraph className="mt-1 max-w-2xl text-muted" size="sm">
          Trusted token metadata, balances, and USD values across every supported EVM network.
        </Typography.Paragraph>
      </header>

      <PortfolioOverview account={account} portfolio={portfolio} />

      {portfolio.partialFailures.length === 0 ? null : (
        <output className="block rounded-lg border bg-secondary px-4 py-3">
          <Typography className="text-sm!" weight="medium">
            Some networks could not be refreshed
          </Typography>
          <Typography className="mt-1 text-xs!" color="muted">
            Showing available balances. Data is temporarily unavailable for{" "}
            {portfolio.partialFailures.length}{" "}
            {portfolio.partialFailures.length === 1 ? "network" : "networks"}.
          </Typography>
        </output>
      )}

      <section aria-labelledby="asset-list" className="grid gap-4">
        <div>
          <Typography.Heading className="text-base" id="asset-list" level={3}>
            Asset balances
          </Typography.Heading>
          <Typography className="mt-1 text-xs!" color="muted">
            Search, filter, group, and inspect enriched token balances by chain.
          </Typography>
        </div>
        <AssetsTable address={account.address} assets={portfolio.items} />
      </section>
    </div>
  );
}

export type { AccountAssetsProps };
