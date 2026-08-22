import { useMemo } from "react";

import type { ActorType } from "@namera-ai/protocol/model";
import { ChartTooltip, PieChart, Typography, Widget } from "@namera-ai/ui";

import { actorDisplay, ExecutionActorDisplay } from "@/components/display/execution-actor-display";

const sourceColors = {
  "api-key": "var(--chart-1)",
  mcp: "var(--chart-2)",
  cli: "var(--chart-3)",
  user: "var(--chart-4)",
} as const satisfies Record<ActorType, string>;
type ExecutionSource = {
  actorType: ActorType;
  count: number;
};

type ExecutionSourcesChartProps = {
  sources: ReadonlyArray<ExecutionSource>;
};

const formatCount = (value: number | string) => Number(value).toLocaleString();
const sourceTooltip = <ChartTooltip.Content hideHeader valueFormatter={formatCount} />;

export function ExecutionSourcesChart({ sources }: ExecutionSourcesChartProps) {
  const total = sources.reduce((sum, source) => sum + source.count, 0);
  const chartData = useMemo(
    () =>
      sources
        .filter((source) => source.count > 0)
        .map((source) => ({
          fill: sourceColors[source.actorType],
          name: actorDisplay[source.actorType].label,
          value: source.count,
        })),
    [sources],
  );

  return (
    <Widget className="h-full">
      <Widget.Header className="pt-4 pb-8">
        <div className="flex flex-col gap-0.5">
          <Widget.Title>Execution sources</Widget.Title>
          <Widget.Description>Where confirmed executions originate</Widget.Description>
        </div>
      </Widget.Header>
      <Widget.Content className="px-5 pb-5 pt-3 sm:px-6">
        {total === 0 ? (
          <div className="flex min-h-64 items-center justify-center">
            <Typography.Paragraph color="muted" size="sm">
              No executions yet
            </Typography.Paragraph>
          </div>
        ) : (
          <div className="flex min-h-64 flex-col">
            <div className="relative min-w-0 flex-1">
              <PieChart aria-label="Executions by actor type" height={190}>
                <PieChart.Pie
                  cornerRadius={4}
                  data={chartData}
                  dataKey="value"
                  innerRadius={62}
                  isAnimationActive={false}
                  nameKey="name"
                  outerRadius={86}
                  paddingAngle={2}
                  stroke="var(--surface)"
                  strokeWidth={2}
                >
                  {chartData.map((source) => (
                    <PieChart.Cell fill={source.fill} key={source.name} />
                  ))}
                </PieChart.Pie>
                <PieChart.Tooltip content={sourceTooltip} />
              </PieChart>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <Typography className="text-xl!" weight="medium">
                  {total.toLocaleString()}
                </Typography>
                <Typography.Paragraph color="muted" size="xs">
                  executions
                </Typography.Paragraph>
              </div>
            </div>
            <Widget.Legend className="flex-wrap justify-center pt-8">
              {sources.map((source) => (
                <Widget.LegendItem color={sourceColors[source.actorType]} key={source.actorType}>
                  <ExecutionActorDisplay type={source.actorType} />
                </Widget.LegendItem>
              ))}
            </Widget.Legend>
          </div>
        )}
      </Widget.Content>
    </Widget>
  );
}
