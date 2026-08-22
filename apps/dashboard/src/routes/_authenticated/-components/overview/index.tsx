import { useMemo } from "react";

import { Link } from "@tanstack/react-router";

import type {
  DashboardOverviewAttentionItem,
  DashboardOverviewMeterUsage,
  ExecutionListItemResponse,
  GetDashboardOverviewResponse,
} from "@namera-ai/protocol/dto";
import { Meter, Surface, Typography } from "@namera-ai/ui";
import { ArrowRight01Icon, HugeiconsIcon, InformationCircleIcon } from "@namera-ai/ui/icons";

import { DataLoading } from "@/components/data-loading";
import {
  ChainDisplay,
  DateDisplay,
  ExecutionActorDisplay,
  MetadataDisplay,
} from "@/components/display";
import { HeadingGroup } from "@/components/heading-group";
import { useDashboardOverview } from "@/hooks/dashboard";

import { ActivityChart } from "./activity-chart";
import { dashboardOverviewPreview } from "./preview-data";

type OverviewProps = {
  preview: boolean;
};

const formatCount = new Intl.NumberFormat(undefined, { notation: "compact" });
const formatUsd = new Intl.NumberFormat(undefined, {
  currency: "USD",
  maximumFractionDigits: 2,
  style: "currency",
});

const usedAmount = (usage: DashboardOverviewMeterUsage) =>
  usage.consumedAmount + usage.reservedAmount;

function MetricCell({ detail, label, value }: { detail: string; label: string; value: string }) {
  return (
    <div className="min-w-0 px-5 py-4 first:border-0 max-md:border-t md:border-l md:px-6">
      <Typography.Paragraph color="muted" size="xs">
        {label}
      </Typography.Paragraph>
      <div className="mt-2 text-xl font-medium tabular-nums tracking-tight text-foreground">
        {value}
      </div>
      <p className="mt-1 truncate text-xs text-muted">{detail}</p>
    </div>
  );
}

function UsageMeter({ label, usage }: { label: string; usage: DashboardOverviewMeterUsage }) {
  const used = usedAmount(usage);
  const limit = usage.limitAmount;
  const maximum = limit === null || limit === 0n ? 1n : limit;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4 text-xs">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums text-foreground">
          {formatCount.format(used)}
          {limit === null ? null : (
            <span className="text-muted"> / {formatCount.format(limit)}</span>
          )}
        </span>
      </div>
      <Meter
        aria-label={`${label} usage`}
        color={used * 100n >= maximum * 90n ? "warning" : "accent"}
        maxValue={Number(maximum)}
        size="sm"
        value={Number(limit === null ? 0n : used)}
      >
        <Meter.Track>
          <Meter.Fill />
        </Meter.Track>
      </Meter>
    </div>
  );
}

function AttentionRow({ item }: { item: DashboardOverviewAttentionItem }) {
  const content = (
    <>
      <span
        className={
          item.severity === "critical"
            ? "mt-0.5 text-danger"
            : item.severity === "warning"
              ? "mt-0.5 text-warning"
              : "mt-0.5 text-muted"
        }
      >
        <HugeiconsIcon className="size-4" icon={InformationCircleIcon} />
      </span>
      <span className="min-w-0 flex-1 text-sm leading-5 text-muted">{item.message}</span>
      <HugeiconsIcon className="mt-0.5 size-4 shrink-0 text-muted" icon={ArrowRight01Icon} />
    </>
  );

  return item.href === undefined ? (
    <div className="flex items-start gap-2.5 px-4 py-3">{content}</div>
  ) : (
    <Link
      className="flex items-start gap-2.5 px-4 py-3 transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
      to={item.href}
    >
      {content}
    </Link>
  );
}

function RecentExecutionRow({ execution }: { execution: ExecutionListItemResponse }) {
  const accountParams = useMemo(() => ({ accountId: execution.wallet.id }), [execution.wallet.id]);
  return (
    <tr className="border-t border-border first:border-0">
      <td className="px-4 py-3 sm:px-5">
        <Link
          className="block min-w-36 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          params={accountParams}
          to="/account/$accountId/overview"
        >
          <MetadataDisplay fallbackName="Unnamed account" metadata={execution.wallet.metadata} />
        </Link>
      </td>
      <td className="px-4 py-3 sm:px-5">
        <ChainDisplay chainId={execution.details.chainId} />
      </td>
      <td className="px-4 py-3 sm:px-5">
        <ExecutionActorDisplay type={execution.actorType} />
      </td>
      <td className="px-4 py-3 text-right sm:px-5">
        <DateDisplay label="Executed" value={execution.details.createdAt} />
      </td>
    </tr>
  );
}

function OverviewContent({ overview }: { overview: GetDashboardOverviewResponse }) {
  const evm = overview.namespaces.find((namespace) => namespace.namespace === "eip155");
  const metrics = useMemo(() => {
    if (evm === undefined) return null;
    const mainnet = evm.usage.mainnetExecutions;
    const gas = evm.usage.sponsoredGasMicroUsd;
    return {
      mainnet,
      gas,
      mainnetValue: `${formatCount.format(usedAmount(mainnet))}${mainnet.limitAmount === null ? "" : ` / ${formatCount.format(mainnet.limitAmount)}`}`,
      gasValue: `${formatUsd.format(Number(usedAmount(gas)) / 1_000_000)}${gas.limitAmount === null ? "" : ` / ${formatUsd.format(Number(gas.limitAmount) / 1_000_000)}`}`,
    };
  }, [evm]);
  if (evm === undefined || metrics === null) return null;

  return (
    <div className="space-y-6">
      <Surface
        className="grid overflow-hidden rounded-xl border md:grid-cols-4"
        variant="secondary"
      >
        <MetricCell
          detail={`${overview.resources.accounts.total} total accounts`}
          label="Active accounts"
          value={`${overview.resources.accounts.active} / ${overview.resources.accounts.included}`}
        />
        <MetricCell
          detail={`${overview.resources.sessionKeys.total} total session keys`}
          label="Active session keys"
          value={formatCount.format(overview.resources.sessionKeys.active)}
        />
        <MetricCell
          detail="Current billing period"
          label="Mainnet executions"
          value={metrics.mainnetValue}
        />
        <MetricCell
          detail="Current billing period"
          label="Sponsored gas"
          value={metrics.gasValue}
        />
      </Surface>

      <div
        className={
          overview.attention.length > 0
            ? "grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]"
            : undefined
        }
      >
        <Surface className="min-w-0 rounded-xl border p-5 sm:p-6" variant="secondary">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <HeadingGroup>
              <HeadingGroup.Title>Activity</HeadingGroup.Title>
              <HeadingGroup.Description>
                Executions and signatures across EVM networks.
              </HeadingGroup.Description>
            </HeadingGroup>
            <div className="flex items-center gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[var(--chart-1)]" /> Executions
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[var(--chart-2)]" /> Signatures
              </span>
              <span>30 days</span>
            </div>
          </div>
          <ActivityChart series={evm.activity.series} />
          <div className="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
            <UsageMeter label="Testnet executions" usage={evm.usage.testnetExecutions} />
            <UsageMeter label="Signatures" usage={evm.usage.signatures} />
            <UsageMeter label="Mainnet executions" usage={evm.usage.mainnetExecutions} />
          </div>
        </Surface>

        {overview.attention.length > 0 ? (
          <section aria-labelledby="attention-heading">
            <div className="mb-3 flex items-center justify-between">
              <HeadingGroup.Title id="attention-heading">Attention</HeadingGroup.Title>
              <span className="text-xs tabular-nums text-muted">{overview.attention.length}</span>
            </div>
            <Surface
              className="divide-y divide-border overflow-hidden rounded-xl border"
              variant="secondary"
            >
              {overview.attention.map((item) => (
                <AttentionRow item={item} key={item.code} />
              ))}
            </Surface>
          </section>
        ) : null}
      </div>

      <section aria-labelledby="recent-activity-heading">
        <div className="mb-3 flex items-end justify-between gap-4">
          <HeadingGroup>
            <HeadingGroup.Title id="recent-activity-heading">Recent activity</HeadingGroup.Title>
            <HeadingGroup.Description>
              Latest confirmed executions in this workspace.
            </HeadingGroup.Description>
          </HeadingGroup>
          <Link className="text-xs text-muted hover:text-foreground" to="/activity">
            View all
          </Link>
        </div>
        <Surface className="overflow-hidden rounded-xl border" variant="secondary">
          {overview.recentExecutions.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">No executions yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead className="sr-only">
                  <tr>
                    <th>Account</th>
                    <th>Network</th>
                    <th>Called by</th>
                    <th>Executed</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.recentExecutions.map((execution) => (
                    <RecentExecutionRow execution={execution} key={execution.details.id} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Surface>
      </section>
    </div>
  );
}

export function Overview({ preview }: OverviewProps) {
  const query = useDashboardOverview();
  const overview = import.meta.env.DEV && preview ? dashboardOverviewPreview : query.data;

  if (overview !== undefined) return <OverviewContent overview={overview} />;
  if (query.isLoading) return <DataLoading className="min-h-96" label="Loading overview" />;
  return (
    <Surface className="rounded-xl border px-5 py-10 text-center" variant="secondary">
      <Typography.Paragraph color="muted" size="sm">
        Couldn&apos;t load the workspace overview.
      </Typography.Paragraph>
    </Surface>
  );
}
