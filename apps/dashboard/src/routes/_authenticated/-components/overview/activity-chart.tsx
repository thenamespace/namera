import { useMemo } from "react";

import type { DashboardOverviewActivityPoint } from "@namera-ai/protocol/dto";
import { AreaChart, ChartTooltip } from "@namera-ai/ui";

const shortDate = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
const chartMargin = { bottom: 0, left: -24, right: 8, top: 8 } as const;
const axisTick = { fill: "var(--muted)", fontSize: 11 } as const;
const chartCursor = { stroke: "var(--border)", strokeWidth: 1 } as const;
const chartGridDash = "3 3";
const formatTooltipLabel = (label: string | number) => label;
const tooltipContent = (
  <ChartTooltip.Content indicator="line" labelFormatter={formatTooltipLabel} />
);

type ActivityChartProps = {
  series: ReadonlyArray<DashboardOverviewActivityPoint>;
};

export function ActivityChart({ series }: ActivityChartProps) {
  const chartData = useMemo(
    () =>
      series.map((point) => ({
        ...point,
        label: shortDate.format(new Date(`${point.date}T00:00:00.000Z`)),
      })),
    [series],
  );

  return (
    <AreaChart
      aria-label="Executions and signatures over the last 30 days"
      className="mt-5"
      data={chartData}
      height={250}
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
        fillOpacity={0.08}
        name="Signatures"
        stackId="operations"
        stroke="var(--chart-2)"
        strokeWidth={1.5}
        type="monotone"
      />
      <AreaChart.Area
        dataKey="executions"
        fill="var(--chart-1)"
        fillOpacity={0.16}
        name="Executions"
        stackId="operations"
        stroke="var(--chart-1)"
        strokeWidth={1.5}
        type="monotone"
      />
    </AreaChart>
  );
}
