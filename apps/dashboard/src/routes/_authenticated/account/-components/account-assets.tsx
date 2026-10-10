import { useMemo } from "react";

import type { PortfolioResponse, WalletResponse } from "@namera-ai/protocol/dto";
import { Button, Card, ChartTooltip, PieChart, Tooltip, Typography } from "@namera-ai/ui";
import { HugeiconsIcon, InformationCircleIcon, RefreshIcon } from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

import { AssetsTable, summarizePortfolio, type AssetAllocation } from "@/components/assets-table";
import { DataLoading } from "@/components/data-loading";
import { ChainDisplay } from "@/components/display";
import { useWalletPortfolio, useRefreshWalletPortfolio } from "@/hooks/wallet";
import { showErrorToast } from "@/lib/toasts";

type PieTooltipProps = {
  readonly active?: boolean;
  readonly payload?: ReadonlyArray<{
    readonly name?: string;
    readonly payload?: AssetAllocation;
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

function PortfolioPieTooltip({
  active,
  payload,
  total,
}: PieTooltipProps & { readonly total: number }) {
  const item = payload?.[0];
  if (active !== true || item === undefined) return null;

  const value = Number(item.value ?? 0);

  return (
    <ChartTooltip>
      <ChartTooltip.Header>{item.name}</ChartTooltip.Header>
      <ChartTooltip.Item>
        <ChartTooltip.Indicator color={item.payload?.color ?? "var(--accent)"} />
        <ChartTooltip.Label>Value</ChartTooltip.Label>
        <ChartTooltip.Value>{currency.format(value)}</ChartTooltip.Value>
      </ChartTooltip.Item>
      <ChartTooltip.Item>
        <ChartTooltip.Indicator color="var(--muted)" />
        <ChartTooltip.Label>Portfolio share</ChartTooltip.Label>
        <ChartTooltip.Value>
          {total === 0 ? "0%" : percent.format(value / total)}
        </ChartTooltip.Value>
      </ChartTooltip.Item>
    </ChartTooltip>
  );
}

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
        className="h-full outline-none ring-inset focus-visible:ring-2 focus-visible:ring-foreground"
        style={style}
        tabIndex={0}
      />
      <Tooltip.Content showArrow>
        <Tooltip.Arrow />
        <ChartTooltip className="border-0 bg-transparent p-0 shadow-none">
          <ChartTooltip.Header>{item.name}</ChartTooltip.Header>
          <ChartTooltip.Item>
            <ChartTooltip.Indicator color={item.color} />
            <ChartTooltip.Label>Value</ChartTooltip.Label>
            <ChartTooltip.Value>{currency.format(item.value)}</ChartTooltip.Value>
          </ChartTooltip.Item>
          <ChartTooltip.Item>
            <ChartTooltip.Indicator color="var(--muted)" />
            <ChartTooltip.Label>Portfolio share</ChartTooltip.Label>
            <ChartTooltip.Value>
              {total === 0 ? "0%" : percent.format(item.value / total)}
            </ChartTooltip.Value>
          </ChartTooltip.Item>
        </ChartTooltip>
      </Tooltip.Content>
    </Tooltip>
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
  unavailableNetworkCount,
}: {
  account: WalletResponse;
  portfolio: PortfolioResponse;
  unavailableNetworkCount: number;
}) {
  const summary = useMemo(
    () => summarizePortfolio(portfolio.items, account.address),
    [account.address, portfolio.items],
  );
  const pieTooltip = useMemo(
    () => <PortfolioPieTooltip total={summary.pricedTotalUsd} />,
    [summary.pricedTotalUsd],
  );

  return (
    <section
      aria-labelledby="portfolio-overview"
      className="grid gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(16rem,0.7fr)]"
    >
      <Card className="overflow-hidden rounded-xl border shadow-sm">
        <Card.Content className="grid min-h-60 gap-6 p-5">
          <div>
            <div className="flex items-center gap-1.5">
              <Typography className="text-sm!" color="muted">
                Total portfolio value
              </Typography>
              {unavailableNetworkCount === 0 ? null : (
                <Tooltip delay={200}>
                  <Tooltip.Trigger>
                    <Button
                      isIconOnly
                      aria-label="Portfolio freshness information"
                      className="size-5 min-h-5 text-muted"
                      size="sm"
                      variant="tertiary"
                    >
                      <HugeiconsIcon className="size-3.5" icon={InformationCircleIcon} />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content className="max-w-64" showArrow>
                    <Tooltip.Arrow />
                    Showing available balances. Data could not be refreshed for{" "}
                    {unavailableNetworkCount}{" "}
                    {unavailableNetworkCount === 1 ? "network" : "networks"}.
                  </Tooltip.Content>
                </Tooltip>
              )}
            </div>
            <Typography.Heading
              className="mt-2 text-4xl tracking-tight tabular-nums"
              id="portfolio-overview"
              level={2}
            >
              {currency.format(summary.pricedTotalUsd)}
            </Typography.Heading>
          </div>

          <div className="self-end">
            <div className="mb-3 flex items-center justify-between gap-4">
              <Typography className="text-sm!" weight="medium">
                Chain allocation
              </Typography>
              <Typography className="text-xs!" color="muted">
                Priced balances
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
        </Card.Content>
      </Card>

      <Card className="rounded-xl border shadow-sm">
        <Card.Header className="pb-0">
          <Card.Title className="text-sm">Asset allocation</Card.Title>
          <Card.Description className="text-xs">Share of priced portfolio value</Card.Description>
        </Card.Header>
        <Card.Content className="grid place-items-center p-5 pt-2">
          <div className="relative mx-auto size-40">
            {summary.assetAllocations.length === 0 ? (
              <div className="absolute inset-3 rounded-full border-12 border-secondary" />
            ) : (
              <PieChart height={160} width={160}>
                <PieChart.Pie
                  cornerRadius={0}
                  cx="50%"
                  cy="50%"
                  data={summary.assetAllocations}
                  dataKey="value"
                  innerRadius="70%"
                  nameKey="name"
                  outerRadius="94%"
                  paddingAngle={0}
                  strokeWidth={0}
                >
                  {summary.assetAllocations.map((item) => (
                    <PieChart.Cell fill={item.color} key={item.id} />
                  ))}
                </PieChart.Pie>
                <PieChart.Tooltip content={pieTooltip} />
              </PieChart>
            )}
            <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
              <span className="text-lg font-semibold tabular-nums">{summary.pricedAssetCount}</span>
              <span className="text-[11px] text-muted">priced assets</span>
            </div>
          </div>
        </Card.Content>
      </Card>
    </section>
  );
}

type AccountAssetsProps = {
  readonly account: WalletResponse;
  readonly initialPortfolio?: PortfolioResponse;
};

export function AccountAssets({ account, initialPortfolio }: AccountAssetsProps) {
  const assets = useWalletPortfolio(account.id);
  const portfolio = assets.data ?? initialPortfolio;
  const refresh = useRefreshWalletPortfolio({
    onError: (error) => showErrorToast(error, { title: "Could not refresh portfolio" }),
  });
  const refreshPortfolio = useEventCallback(() =>
    refresh.mutate({
      params: { walletId: account.id },
      query: { refresh: true, pageSize: 100 },
    }),
  );

  return (
    <div className="grid w-full gap-7 px-3">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Typography.Heading className="text-2xl tracking-tight" level={2}>
            Assets
          </Typography.Heading>
          <Typography.Paragraph className="mt-1 max-w-2xl text-muted" size="sm">
            Token balances and USD values across supported networks.
          </Typography.Paragraph>
        </div>
        <Button
          isIconOnly
          variant="tertiary"
          aria-label="Refresh portfolio"
          isDisabled={refresh.isPending || assets.isFetching}
          onPress={refreshPortfolio}
        >
          <HugeiconsIcon
            className={
              refresh.isPending || assets.isFetching
                ? "size-4 animate-spin motion-reduce:animate-none"
                : "size-4"
            }
            icon={RefreshIcon}
          />
        </Button>
      </header>
      {refresh.isError || assets.isError ? (
        <output className="text-sm text-muted">
          Could not refresh portfolio.{" "}
          {portfolio ? "Showing previously loaded balances." : "Try refreshing again."}
        </output>
      ) : null}

      {portfolio ? (
        <PortfolioOverview
          account={account}
          portfolio={portfolio}
          unavailableNetworkCount={portfolio.partialFailures.length}
        />
      ) : (
        <DataLoading className="min-h-64" label="Loading portfolio overview" />
      )}

      <section aria-labelledby="asset-list" className="grid gap-4">
        <div>
          <Typography.Heading className="text-base" id="asset-list" level={3}>
            Asset balances
          </Typography.Heading>
          <Typography className="mt-1 text-xs!" color="muted">
            Search and filter token balances by chain.
          </Typography>
        </div>
        {portfolio ? (
          <AssetsTable address={account.address} assets={portfolio.items} />
        ) : (
          <DataLoading className="min-h-64" label="Loading asset balances" />
        )}
      </section>
    </div>
  );
}

export type { AccountAssetsProps };
