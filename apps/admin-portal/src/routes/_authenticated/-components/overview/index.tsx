import { useCallback, useState, type Key } from "react";

import type { AdminOverviewPeriod } from "@namera-ai/protocol/dto";
import { Button, Segment, Typography } from "@namera-ai/ui";

import { useOverview } from "@/hooks/overview";

import { OverviewChart } from "./activity-chart";
import { OverviewKpis } from "./kpi-grid";

const periods = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
] as const;

export function Overview() {
  const [period, setPeriod] = useState<AdminOverviewPeriod>("30d");
  const overview = useOverview(period);
  const changePeriod = useCallback((key: Key) => {
    const next = periods.find((option) => option.id === key);
    if (next) setPeriod(next.id);
  }, []);

  return (
    <div className="grid min-w-0 gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Typography.Heading level={2} weight="medium" className="text-2xl">
            Overview
          </Typography.Heading>
        </div>
        <Segment
          aria-label="Overview period"
          selectedKey={period}
          size="sm"
          variant="ghost"
          onSelectionChange={changePeriod}
        >
          {periods.map((option) => (
            <Segment.Item id={option.id} key={option.id}>
              {option.label}
            </Segment.Item>
          ))}
        </Segment>
      </div>
      {overview.error ? (
        <div role="alert" className="flex items-center gap-3 text-sm">
          <p>Couldn’t load the overview.</p>
          <Button size="sm" variant="tertiary" onPress={overview.refetch}>
            Try again
          </Button>
        </div>
      ) : !overview.data ? (
        <output className="py-12 text-center text-sm text-muted">Loading overview…</output>
      ) : (
        <>
          <OverviewKpis overview={overview.data} />
          <div className="grid min-w-0 gap-3 xl:grid-cols-2">
            <OverviewChart points={overview.data.activity} kind="growth" />
            <OverviewChart points={overview.data.activity} kind="activity" />
          </div>
        </>
      )}
    </div>
  );
}
