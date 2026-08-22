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
};

function ResourceKPI({ active, icon, title, total, value }: ResourceKPIProps) {
  return (
    <KPI className="min-h-24 border p-3">
      <KPI.Header className="gap-1!">
        <KPI.Icon className="size-5 text-muted">
          <HugeiconsIcon icon={icon} />
        </KPI.Icon>
        <KPI.Title>{title}</KPI.Title>
        <Typography.Paragraph className="ml-auto" color="muted" size="xs">
          {total === 0 ? "No resources" : `${active} active`}
        </Typography.Paragraph>
      </KPI.Header>
      <KPI.Content className="mt-2 content-start">
        <KPI.Value notation="compact" value={value} />
      </KPI.Content>
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
    <KPI className="min-h-24 border p-3">
      <KPI.Header className="gap-1!">
        <KPI.Icon className="size-5 text-muted">
          <HugeiconsIcon icon={icon} />
        </KPI.Icon>
        <KPI.Title>{title}</KPI.Title>
        <Typography.Paragraph className="ml-auto" color="muted" size="xs">
          {current.toLocaleString()} · 7d
        </Typography.Paragraph>
      </KPI.Header>
      <KPI.Content className="mt-2 grid-cols-[auto_minmax(48px,1fr)_auto]! gap-2">
        <KPI.Value notation="compact" value={total} />
        <KPI.Chart
          className="min-w-0"
          color={color}
          data={chartData}
          height={30}
          strokeWidth={1.5}
        />
        <KPI.Trend trend={change > 0 ? "up" : change < 0 ? "down" : "neutral"}>
          {roundedChange}%
        </KPI.Trend>
      </KPI.Content>
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
      />
      <ResourceKPI
        active={sessionKeys.active}
        icon={Key01Icon}
        title="Session keys"
        total={sessionKeys.total}
        value={sessionKeys.active}
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
