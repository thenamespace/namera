import { useMemo } from "react";

import type { AdminOverviewPoint } from "@namera-ai/protocol/dto";
import { AreaChart, ChartTooltip, Typography, Widget } from "@namera-ai/ui";

const dateLabel = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const chartMargin = { bottom: 0, left: 0, right: 12, top: 8 } as const;
const axisTick = { fill: "var(--muted)", fontSize: 11 } as const;
const cursor = { stroke: "var(--border)", strokeWidth: 1 } as const;
const tooltip = <ChartTooltip.Content indicator="line" />;
const seriesByKind = {
  growth: [
    { key: "users", label: "New users" },
    { key: "waitlist", label: "Waitlist joins" },
  ],
  activity: [
    { key: "executions", label: "Executions" },
    { key: "signatures", label: "Signatures" },
  ],
} as const;

export function OverviewChart({
  points,
  kind,
}: {
  points: ReadonlyArray<AdminOverviewPoint>;
  kind: keyof typeof seriesByKind;
}) {
  const series = seriesByKind[kind];
  const data = useMemo(
    () =>
      points.map((point) => ({
        ...point,
        label: dateLabel.format(new Date(`${point.date}T00:00:00Z`)),
      })),
    [points],
  );
  const empty = points.every((point) => series.every(({ key }) => point[key] === 0));
  const title = kind === "growth" ? "User growth" : "Wallet activity";
  return (
    <Widget className="min-w-0">
      <Widget.Header className="pt-4 pb-5">
        <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <Widget.Title>{title}</Widget.Title>
          <Widget.Description className="text-xs">
            {kind === "growth"
              ? "Daily signups and waitlist joins"
              : "Daily executions and signatures"}
          </Widget.Description>
        </div>
      </Widget.Header>
      <Widget.Content className="border-none p-0">
        {empty ? (
          <div className="flex h-64 items-center justify-center px-5 text-center">
            <Typography.Paragraph color="muted" size="sm">
              {kind === "growth"
                ? "No new users or waitlist joins in this period."
                : "No confirmed executions or successful signatures in this period."}
            </Typography.Paragraph>
          </div>
        ) : (
          <AreaChart
            aria-label={`${title} by UTC day`}
            data={data}
            height={256}
            margin={chartMargin}
          >
            <AreaChart.Grid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <AreaChart.XAxis
              axisLine={false}
              dataKey="label"
              interval="preserveStartEnd"
              minTickGap={32}
              tick={axisTick}
              tickLine={false}
            />
            <AreaChart.YAxis
              allowDecimals={false}
              axisLine={false}
              tick={axisTick}
              tickLine={false}
              width={40}
            />
            <AreaChart.Tooltip content={tooltip} cursor={cursor} />
            {series.map((entry, index) => (
              <AreaChart.Area
                key={entry.key}
                dataKey={entry.key}
                name={entry.label}
                fill={`var(--chart-${index + 1})`}
                fillOpacity={0.08}
                stroke={`var(--chart-${index + 1})`}
                strokeWidth={1.5}
                type="linear"
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        )}
      </Widget.Content>
      <div className="flex justify-center px-4 pt-3 pb-4">
        <Widget.Legend>
          {series.map((entry, index) => (
            <Widget.LegendItem key={entry.key} color={`var(--chart-${index + 1})`}>
              {entry.label}
            </Widget.LegendItem>
          ))}
        </Widget.Legend>
      </div>
    </Widget>
  );
}
