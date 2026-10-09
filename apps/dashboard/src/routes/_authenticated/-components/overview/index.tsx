import { useCallback, useState } from "react";

import { Link } from "@tanstack/react-router";

import type {
  DashboardOverviewActivitySeries,
  GetDashboardOverviewResponse,
} from "@namera-ai/protocol/dto";
import { Segment, Surface, Typography, Widget } from "@namera-ai/ui";

import { DataLoading } from "@/components/data-loading";
import { ExecutionsTable } from "@/components/executions-table";
import { HeadingGroup } from "@/components/heading-group";
import { useDashboardOverview } from "@/hooks/dashboard";

import { ActivityChart } from "./activity-chart";
import { ExecutionSourcesChart } from "./execution-sources-chart";
import { OverviewKPIGrid } from "./kpi-grid";

type ActivityView = "daily" | "weekly" | "monthly";

const activityOptions = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
] as const;

function ActivityWidget({
  activity,
}: {
  activity: Record<ActivityView, DashboardOverviewActivitySeries>;
}) {
  const [view, setView] = useState<ActivityView>("daily");
  const handleViewChange = useCallback((key: React.Key) => {
    setView(String(key) as ActivityView);
  }, []);

  return (
    <Widget>
      <Widget.Header className="pt-4 pb-8">
        <div className="flex flex-col">
          <Widget.Title>Operations activity</Widget.Title>
          <Widget.Description>Confirmed executions and signatures over time</Widget.Description>
        </div>
        <Segment
          aria-label="Activity aggregation"
          selectedKey={view}
          size="sm"
          variant="ghost"
          onSelectionChange={handleViewChange}
        >
          {activityOptions.map((option) => (
            <Segment.Item id={option.id} key={option.id}>
              {option.label}
            </Segment.Item>
          ))}
        </Segment>
      </Widget.Header>
      <Widget.Content className="relative border-none p-0">
        <ActivityChart series={activity[view]} />
      </Widget.Content>
    </Widget>
  );
}

function OverviewContent({ overview }: { overview: GetDashboardOverviewResponse }) {
  const evm = overview.namespaces.find((namespace) => namespace.namespace === "eip155");
  if (evm === undefined) return null;

  return (
    <div className="space-y-5">
      <OverviewKPIGrid
        accounts={overview.resources.accounts}
        dailyActivity={evm.activity.daily}
        executions={Number(evm.totals.executions)}
        sessionKeys={overview.resources.sessionKeys}
        signatures={Number(evm.totals.signatures)}
      />

      <div className="grid items-stretch gap-3 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]">
        <ActivityWidget activity={evm.activity} />
        <ExecutionSourcesChart sources={evm.executionSources} />
      </div>

      <section aria-labelledby="recent-activity-heading">
        <div className="mb-3 flex items-center justify-between gap-4 px-0.5">
          <HeadingGroup.Title id="recent-activity-heading">Recent activity</HeadingGroup.Title>
          <Link
            className="text-xs text-muted transition-colors hover:text-foreground"
            to="/activity"
          >
            View all
          </Link>
        </div>
        <ExecutionsTable variant="summary" />
      </section>
    </div>
  );
}

export function Overview() {
  const query = useDashboardOverview();

  if (query.data !== undefined) return <OverviewContent overview={query.data} />;
  if (query.isLoading) return <DataLoading className="min-h-96" label="Loading overview" />;
  return (
    <Surface className="rounded-xl border px-5 py-10 text-center" variant="secondary">
      <Typography.Paragraph color="muted" size="sm">
        Couldn&apos;t load the workspace overview.
      </Typography.Paragraph>
    </Surface>
  );
}
