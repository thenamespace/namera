import { useMemo } from "react";

import type { DashboardOverviewActivitySeries } from "@namera-ai/protocol/dto";
import { AreaChart, ChartTooltip } from "@namera-ai/ui";

const dayLabel = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
const monthLabel = new Intl.DateTimeFormat(undefined, { month: "short", year: "2-digit" });
const chartMargin = { bottom: 0, left: -24, right: 8, top: 8 } as const;
const axisTick = { fill: "var(--muted)", fontSize: 11 } as const;
const chartCursor = { stroke: "var(--border)", strokeWidth: 1 } as const;
const chartGridDash = "3 3";
const formatTooltipLabel = (label: string | number) => label;
const tooltipContent = (
  <ChartTooltip.Content indicator="line" labelFormatter={formatTooltipLabel} />
);

const formatPeriod = (date: string, granularity: DashboardOverviewActivitySeries["granularity"]) =>
  (granularity === "month" ? monthLabel : dayLabel).format(new Date(`${date}T00:00:00.000Z`));

type ActivityChartProps = {
  series: DashboardOverviewActivitySeries;
};

export function ActivityChart({ series }: ActivityChartProps) {
  const chartData = useMemo(
    () =>
      series.points.map((point) => ({
        ...point,
        label: formatPeriod(point.date, series.granularity),
      })),
    [series],
  );

  return (
    <AreaChart
      aria-label={`Executions and signatures by ${series.granularity}`}
      data={chartData}
      height={280}
      margin={chartMargin}
    >
      <AreaChart.Grid stroke="var(--border)" strokeDasharray={chartGridDash} vertical={false} />
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
        width={36}
      />
      <AreaChart.Tooltip content={tooltipContent} cursor={chartCursor} />
      <AreaChart.Area
        dataKey="signatures"
        fill="var(--chart-2)"
        fillOpacity={0.06}
        name="Signatures"
        stroke="var(--chart-2)"
        strokeWidth={1.5}
        type="monotone"
        isAnimationActive={false}
      />
      <AreaChart.Area
        dataKey="executions"
        fill="var(--chart-1)"
        fillOpacity={0.12}
        name="Executions"
        stroke="var(--chart-1)"
        strokeWidth={1.5}
        type="monotone"
        isAnimationActive={false}
      />
    </AreaChart>
  );
}
