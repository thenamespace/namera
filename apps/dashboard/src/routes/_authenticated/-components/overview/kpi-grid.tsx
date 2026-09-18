import { type ReactNode, useCallback, useMemo } from "react";

import { useNavigate } from "@tanstack/react-router";

import type { DashboardOverviewActivitySeries } from "@namera-ai/protocol/dto";
import { Button, Chip, KPI, Tooltip, Typography } from "@namera-ai/ui";
import {
  Activity02Icon,
  Add01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  HugeiconsIcon,
  InformationCircleIcon,
  Key01Icon,
  SignatureIcon,
  Wallet01Icon,
} from "@namera-ai/ui/icons";

type ResourceKPIProps = {
  active: number;
  createLabel?: string;
  icon: typeof Wallet01Icon;
  info?: string;
  onCreate?: () => void;
  title: string;
  total: number;
  value: number;
};

function ResourceKPI({
  active,
  createLabel,
  icon,
  info,
  onCreate,
  title,
  total,
  value,
}: ResourceKPIProps) {
  return (
    <KPI className="h-28 border p-3">
      <KPI.Header className="gap-0!">
        <KPI.Icon>
          <HugeiconsIcon icon={icon} className="text-muted" />
        </KPI.Icon>
        <KPI.Title>{title}</KPI.Title>
        {info !== undefined ? (
          <Tooltip closeDelay={0} delay={200}>
            <Tooltip.Trigger
              aria-label={`What is ${title.replace(/s$/, "").toLowerCase()}?`}
              className="ml-0.5 inline-grid size-6 place-items-center rounded-md text-muted transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              <HugeiconsIcon icon={InformationCircleIcon} className="size-3.5" />
            </Tooltip.Trigger>
            <Tooltip.Content
              className="max-w-[16rem] text-left text-pretty break-normal! whitespace-normal!"
              showArrow
            >
              <Tooltip.Arrow />
              {info}
            </Tooltip.Content>
          </Tooltip>
        ) : null}
      </KPI.Header>
      <KPI.Content className="mt-auto items-end px-2 py-2">
        <KPI.Value className="text-2xl! leading-none!" notation="compact" value={value} />
        {total === 0 && onCreate !== undefined ? (
          <Button size="sm" variant="secondary" onPress={onCreate}>
            <HugeiconsIcon icon={Add01Icon} />
            {createLabel}
          </Button>
        ) : (
          <Chip color={active > 0 ? "success" : "default"} size="sm" variant="soft">
            <Chip.Label>{total === 0 ? "No resources" : `${active} active`}</Chip.Label>
          </Chip>
        )}
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
  const { change } = operationTrend(series, valueKey);
  const roundedChange = Math.round(Math.abs(change));
  const chartData = useMemo(
    () => series.points.map((point) => ({ value: point[valueKey] })),
    [series.points, valueKey],
  );

  return (
    <KPI className="h-28 border p-3">
      <KPI.Header className="gap-1.5!">
        <KPI.Icon className="size-5 text-muted">
          <HugeiconsIcon icon={icon} />
        </KPI.Icon>
        <KPI.Title>{title}</KPI.Title>
      </KPI.Header>
      <KPI.Content className="mt-auto grid-cols-[minmax(90px,0.8fr)_minmax(0,1.2fr)]! items-end gap-2 pt-2">
        <div className="space-y-1.5">
          <KPI.Value className="text-2xl! leading-none!" notation="compact" value={total} />
          <div className="flex items-center gap-1">
            {change === 0 ? null : (
              <HugeiconsIcon
                className={change > 0 ? "size-3.5 text-success" : "size-3.5 text-danger"}
                icon={change > 0 ? ArrowUp01Icon : ArrowDown01Icon}
              />
            )}
            <Typography.Paragraph
              className={change > 0 ? "text-success!" : change < 0 ? "text-danger!" : "text-muted!"}
              size="xs"
              weight="medium"
            >
              {roundedChange}%
            </Typography.Paragraph>
            <Typography.Paragraph className="whitespace-nowrap" color="muted" size="xs">
              last 7d
            </Typography.Paragraph>
          </div>
        </div>
        <KPI.Chart
          className="min-w-0"
          color={color}
          data={chartData}
          height={36}
          strokeWidth={1.75}
        />
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
  const navigate = useNavigate();
  const createAccount = useCallback(() => {
    void navigate({ to: "/accounts" });
  }, [navigate]);
  const createSessionKey = useCallback(() => {
    void navigate({ to: "/session-keys" });
  }, [navigate]);

  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <ResourceKPI
        active={accounts.active}
        createLabel="Create account"
        icon={Wallet01Icon}
        info="A smart wallet your agents transact through. You own it with your passkey, and it enforces your rules on every transaction."
        onCreate={createAccount}
        title="Accounts"
        total={accounts.total}
        value={accounts.total}
      />
      <ResourceKPI
        active={sessionKeys.active}
        createLabel="Create session key"
        icon={Key01Icon}
        info="A scoped key you grant an agent — limited to the spend, contracts, networks, and expiry you set."
        onCreate={createSessionKey}
        title="Session keys"
        total={sessionKeys.total}
        value={sessionKeys.total}
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
