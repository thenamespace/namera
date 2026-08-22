import { DateTime, Effect, Metric } from "effect";

import { Repository, type DashboardActivityCount } from "@namera-ai/database";
import type { OrganizationId } from "@namera-ai/protocol";
import type {
  DashboardOverviewActivityPoint,
  DashboardOverviewActivitySeries,
  GetDashboardOverviewResponse,
} from "@namera-ai/protocol/dto";
import { dashboardOverviewReadDuration, dashboardOverviewReads } from "@namera-ai/telemetry";

type ActivityGranularity = DashboardOverviewActivitySeries["granularity"];

const activityWindows = {
  day: 14,
  week: 12,
  month: 12,
} as const satisfies Record<ActivityGranularity, number>;

export interface DashboardOverviewApplication {
  readonly get: (organizationId: OrganizationId) => Effect.Effect<GetDashboardOverviewResponse>;
}

const startOf = (value: DateTime.Utc, granularity: ActivityGranularity) =>
  DateTime.startOf(value, granularity, granularity === "week" ? { weekStartsOn: 1 } : undefined);

const activitySeries = (
  now: DateTime.Utc,
  counts: ReadonlyArray<DashboardActivityCount>,
  granularity: ActivityGranularity,
): DashboardOverviewActivitySeries => {
  const window = activityWindows[granularity];
  const currentPeriod = startOf(now, granularity);
  const firstPeriod = DateTime.subtract(currentPeriod, { [`${granularity}s`]: window - 1 });
  const points = new Map<string, DashboardOverviewActivityPoint>();

  for (let offset = 0; offset < window; offset += 1) {
    const date = DateTime.formatIsoDateUtc(
      DateTime.add(firstPeriod, { [`${granularity}s`]: offset }),
    );
    points.set(date, { date, executions: 0, signatures: 0 });
  }

  for (const count of counts) {
    if (count.namespace !== "eip155") continue;
    const date = DateTime.formatIsoDateUtc(
      startOf(DateTime.makeUnsafe(`${count.date}T00:00:00.000Z`), granularity),
    );
    const point = points.get(date);
    if (point === undefined) continue;
    points.set(date, {
      ...point,
      ...(count.operation === "execution"
        ? { executions: point.executions + count.count }
        : { signatures: point.signatures + count.count }),
    });
  }

  return { granularity, points: [...points.values()] };
};

export const makeDashboardOverviewApplication = () =>
  Effect.gen(function* () {
    const repository = yield* Repository;

    const get = Effect.fn("application.dashboardOverview.get")(
      function* (organizationId: OrganizationId) {
        const now = yield* DateTime.now;
        const since = DateTime.subtract(DateTime.startOf(now, "month"), {
          months: activityWindows.month - 1,
        });
        const [resources, totals, counts, executionSources] = yield* Effect.all(
          [
            repository.core.dashboardOverview.getResources(organizationId),
            repository.core.dashboardOverview.getOperationTotals(organizationId),
            repository.core.dashboardOverview.getActivity(organizationId, since),
            repository.core.dashboardOverview.getExecutionSources(organizationId),
          ],
          { concurrency: "unbounded" },
        );

        yield* Metric.update(dashboardOverviewReads, 1);
        return {
          organizationId,
          resources,
          namespaces: [
            {
              namespace: "eip155" as const,
              totals: {
                executions: BigInt(
                  totals.find(
                    (total) => total.namespace === "eip155" && total.operation === "execution",
                  )?.count ?? 0,
                ),
                signatures: BigInt(
                  totals.find(
                    (total) => total.namespace === "eip155" && total.operation === "signature",
                  )?.count ?? 0,
                ),
              },
              activity: {
                daily: activitySeries(now, counts, "day"),
                weekly: activitySeries(now, counts, "week"),
                monthly: activitySeries(now, counts, "month"),
              },
              executionSources: executionSources
                .filter((source) => source.namespace === "eip155")
                .map(({ actorType, count }) => ({ actorType, count })),
            },
          ],
        } satisfies GetDashboardOverviewResponse;
      },
      Effect.trackDuration(dashboardOverviewReadDuration),
      Effect.catchTag("DatabaseError", Effect.die),
    );

    return { get } satisfies DashboardOverviewApplication;
  });
