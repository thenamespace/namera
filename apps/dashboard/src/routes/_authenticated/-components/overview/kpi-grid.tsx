import { type ReactNode, useMemo } from "react";

import type { DashboardOverviewActivitySeries } from "@namera-ai/protocol/dto";
import { KPI, Typography } from "@namera-ai/ui";
import {
  Activity02Icon,
  HugeiconsIcon,
  Key01Icon,
  SignatureIcon,
  Wallet01Icon,
} from "@namera-ai/ui/icons";

type ResourceKPIProps = {
  active: number;
  icon: typeof Wallet01Icon;
  title: string;
  total: number;
  value: number;
  valueLabel: string;
};

function ResourceKPI({ active, icon, title, total, value, valueLabel }: ResourceKPIProps) {
  const activePercentage = total === 0 ? 0 : (active / total) * 100;

  return (
    <KPI className="min-h-32 border p-3">
      <KPI.Header>
        <KPI.Icon>
          <HugeiconsIcon icon={icon} />
        </KPI.Icon>
        <KPI.Title>{title}</KPI.Title>
      </KPI.Header>
      <KPI.Content className="mt-1 content-start">
        <KPI.Value notation="compact" value={value} />
        <KPI.Progress aria-label={`${active} of ${total} active`} value={activePercentage} />
      </KPI.Content>
      <KPI.Footer className="mt-auto flex items-center justify-between pt-1.5">
        <Typography.Paragraph color="muted" size="xs">
          {valueLabel}
        </Typography.Paragraph>
        <Typography.Paragraph color="muted" size="xs">
          {total === 0 ? "No resources yet" : `${active} active`}
        </Typography.Paragraph>
      </KPI.Footer>
    </KPI>
  );
}

type OperationKPIProps = {
  color: string;
  icon: typeof Activity02Icon;
  series: DashboardOverviewActivitySeries;
  title: string;
  total: number;
  valueKey: "executions" | "signatures";
};

function operationTrend(
  series: DashboardOverviewActivitySeries,
  key: OperationKPIProps["valueKey"],
) {
  const midpoint = Math.floor(series.points.length / 2);
  const previous = series.points.slice(0, midpoint).reduce((total, point) => total + point[key], 0);
  const current = series.points.slice(midpoint).reduce((total, point) => total + point[key], 0);
  const change =
    previous === 0 ? (current === 0 ? 0 : 100) : ((current - previous) / previous) * 100;

  return { change, current };
}

function OperationKPI({ color, icon, series, title, total, valueKey }: OperationKPIProps) {
  const { change, current } = operationTrend(series, valueKey);
  const roundedChange = Math.round(Math.abs(change));
  const chartData = useMemo(
    () => series.points.map((point) => ({ value: point[valueKey] })),
    [series.points, valueKey],
  );

  return (
    <KPI className="min-h-32 border p-3">
      <KPI.Header>
        <KPI.Icon>
          <HugeiconsIcon icon={icon} />
        </KPI.Icon>
        <KPI.Title>{title}</KPI.Title>
      </KPI.Header>
      <KPI.Content className="mt-1">
        <KPI.Value notation="compact" value={total} />
        <KPI.Trend trend={change > 0 ? "up" : change < 0 ? "down" : "neutral"}>
          {roundedChange}%
        </KPI.Trend>
      </KPI.Content>
      <KPI.Chart className="mt-0.5" color={color} data={chartData} height={30} strokeWidth={1.5} />
      <KPI.Footer className="flex items-center justify-between pt-1.5">
        <Typography.Paragraph color="muted" size="xs">
          {current.toLocaleString()} in the last 7 days
        </Typography.Paragraph>
        <Typography.Paragraph color="muted" size="xs">
          All time
        </Typography.Paragraph>
      </KPI.Footer>
    </KPI>
  );
}

type OverviewKPIGridProps = {
  accounts: { active: number; total: number };
  dailyActivity: DashboardOverviewActivitySeries;
  executions: number;
  sessionKeys: { active: number; total: number };
  signatures: number;
};

export function OverviewKPIGrid({
  accounts,
  dailyActivity,
  executions,
  sessionKeys,
  signatures,
}: OverviewKPIGridProps): ReactNode {
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <ResourceKPI
        active={accounts.active}
        icon={Wallet01Icon}
        title="Accounts"
        total={accounts.total}
        value={accounts.total}
        valueLabel="Total accounts"
      />
      <ResourceKPI
        active={sessionKeys.active}
        icon={Key01Icon}
        title="Session keys"
        total={sessionKeys.total}
        value={sessionKeys.active}
        valueLabel="Active keys"
      />
      <OperationKPI
        color="var(--chart-1)"
        icon={Activity02Icon}
        series={dailyActivity}
        title="Executions"
        total={executions}
        valueKey="executions"
      />
      <OperationKPI
        color="var(--chart-2)"
        icon={SignatureIcon}
        series={dailyActivity}
        title="Signatures"
        total={signatures}
        valueKey="signatures"
      />
    </dl>
  );
}
