import { useCallback, useState } from "react";

import { Link } from "@tanstack/react-router";

import type {
  DashboardOverviewActivitySeries,
  GetDashboardOverviewResponse,
} from "@namera-ai/protocol/dto";
import { KPI, KPIGroup, Segment, Surface, Typography, Widget } from "@namera-ai/ui";

import { DataLoading } from "@/components/data-loading";
import { ExecutionsTable } from "@/components/executions-table";
import { HeadingGroup } from "@/components/heading-group";
import { useDashboardOverview } from "@/hooks/dashboard";

import { ActivityChart } from "./activity-chart";
import { dashboardExecutionsPreview, dashboardOverviewPreview } from "./preview-data";

type OverviewProps = {
  preview: boolean;
};

type ActivityView = "daily" | "weekly" | "monthly";

const activityOptions = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
] as const;

function OverviewKPI({ label, value }: { label: string; value: number }) {
  return (
    <KPI>
      <KPI.Header>
        <KPI.Title>{label}</KPI.Title>
      </KPI.Header>
      <KPI.Content>
        <KPI.Value notation="compact" value={value} />
      </KPI.Content>
    </KPI>
  );
}

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
      <Widget.Header>
        <Widget.Title>Activity</Widget.Title>
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
      <Widget.Content className="px-4 pb-2 pt-3 sm:px-5">
        <ActivityChart series={activity[view]} />
      </Widget.Content>
      <Widget.Footer className="justify-between">
        <Widget.Legend>
          <Widget.LegendItem color="var(--chart-1)">Executions</Widget.LegendItem>
          <Widget.LegendItem color="var(--chart-2)">Signatures</Widget.LegendItem>
        </Widget.Legend>
        <Typography.Paragraph color="muted" size="xs">
          {activity[view].points.length}{" "}
          {view === "daily" ? "days" : view === "weekly" ? "weeks" : "months"}
        </Typography.Paragraph>
      </Widget.Footer>
    </Widget>
  );
}

function OverviewContent({
  overview,
  preview,
}: {
  overview: GetDashboardOverviewResponse;
  preview: boolean;
}) {
  const evm = overview.namespaces.find((namespace) => namespace.namespace === "eip155");
  if (evm === undefined) return null;

  return (
    <div className="space-y-6">
      <KPIGroup className="max-md:grid max-md:grid-cols-2">
        <OverviewKPI label="Accounts" value={overview.resources.accounts.total} />
        <KPIGroup.Separator className="max-md:hidden" />
        <OverviewKPI label="Active session keys" value={overview.resources.sessionKeys.active} />
        <KPIGroup.Separator className="max-md:hidden" />
        <OverviewKPI label="Executions" value={Number(evm.totals.executions)} />
        <KPIGroup.Separator className="max-md:hidden" />
        <OverviewKPI label="Signatures" value={Number(evm.totals.signatures)} />
      </KPIGroup>

      <ActivityWidget activity={evm.activity} />

      <section aria-labelledby="recent-activity-heading">
        <div className="mb-3 flex items-center justify-between gap-4">
          <HeadingGroup.Title id="recent-activity-heading">Recent activity</HeadingGroup.Title>
          <Link
            className="text-xs text-muted transition-colors hover:text-foreground"
            to="/activity"
          >
            View all
          </Link>
        </div>
        <ExecutionsTable
          variant="summary"
          {...(import.meta.env.DEV && preview ? { dataOverride: dashboardExecutionsPreview } : {})}
        />
      </section>
    </div>
  );
}

export function Overview({ preview }: OverviewProps) {
  const query = useDashboardOverview();
  const overview = import.meta.env.DEV && preview ? dashboardOverviewPreview : query.data;

  if (overview !== undefined) return <OverviewContent overview={overview} preview={preview} />;
  if (query.isLoading) return <DataLoading className="min-h-96" label="Loading overview" />;
  return (
    <Surface className="rounded-xl border px-5 py-10 text-center" variant="secondary">
      <Typography.Paragraph color="muted" size="sm">
        Couldn&apos;t load the workspace overview.
      </Typography.Paragraph>
    </Surface>
  );
}
