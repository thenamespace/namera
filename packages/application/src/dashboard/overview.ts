import { DateTime, Effect, Metric } from "effect";

import { Repository, type DashboardActivityCount } from "@namera-ai/database";
import type { OrganizationId } from "@namera-ai/protocol";
import type {
  DashboardOverviewActivityPoint,
  DashboardOverviewAttentionItem,
  DashboardOverviewMeterUsage,
  GetBillingResponse,
  GetDashboardOverviewResponse,
} from "@namera-ai/protocol/dto";
import { dashboardOverviewReadDuration, dashboardOverviewReads } from "@namera-ai/telemetry";

import type { BillingApplication } from "#/billing/index";
import type { ExecutionReadApplication } from "#/execution/read";

const activityWindowDays = 30;
const recentExecutionLimit = 6;

export interface DashboardOverviewApplication {
  readonly get: (organizationId: OrganizationId) => Effect.Effect<GetDashboardOverviewResponse>;
}

const meterUsage = (
  billing: GetBillingResponse,
  key: GetBillingResponse["meters"][number]["key"],
): DashboardOverviewMeterUsage => {
  const meter = billing.meters.find((candidate) => candidate.key === key);
  if (meter === undefined) {
    return { consumedAmount: 0n, reservedAmount: 0n, limitAmount: null };
  }
  return {
    consumedAmount: meter.consumedAmount,
    reservedAmount: meter.reservedAmount,
    limitAmount: meter.hardLimitAmount,
  };
};

const activitySeries = (
  today: DateTime.Utc,
  counts: ReadonlyArray<DashboardActivityCount>,
): ReadonlyArray<DashboardOverviewActivityPoint> => {
  const start = DateTime.subtract(DateTime.startOf(today, "day"), {
    days: activityWindowDays - 1,
  });
  const points = new Map<string, DashboardOverviewActivityPoint>();
  for (let offset = 0; offset < activityWindowDays; offset += 1) {
    const date = DateTime.formatIsoDateUtc(DateTime.add(start, { days: offset }));
    points.set(date, { date, executions: 0, failedExecutions: 0, signatures: 0 });
  }
  for (const count of counts) {
    const point = points.get(count.date);
    if (point === undefined || count.namespace !== "eip155") continue;
    points.set(count.date, {
      ...point,
      ...(count.operation === "execution" ? { executions: point.executions + count.count } : {}),
      ...(count.operation === "failed-execution"
        ? { failedExecutions: point.failedExecutions + count.count }
        : {}),
      ...(count.operation === "signature" ? { signatures: point.signatures + count.count } : {}),
    });
  }
  return [...points.values()];
};

const usageAttention = (
  code: "mainnet-executions-near-limit" | "sponsored-gas-near-limit",
  label: string,
  usage: DashboardOverviewMeterUsage,
  href: string,
): DashboardOverviewAttentionItem | undefined => {
  const limit = usage.limitAmount;
  if (limit === null || limit === 0n) return undefined;
  const used = usage.consumedAmount + usage.reservedAmount;
  const percentage = Number((used * 100n) / limit);
  if (percentage < 80) return undefined;
  return {
    code,
    severity: percentage >= 95 ? "critical" : "warning",
    count: percentage,
    message: `${label} is ${percentage}% used for this billing period.`,
    href,
  };
};

export const makeDashboardOverviewApplication = (
  billing: BillingApplication,
  execution: ExecutionReadApplication,
) =>
  Effect.gen(function* () {
    const repository = yield* Repository;

    const get = Effect.fn("application.dashboardOverview.get")(
      function* (organizationId: OrganizationId) {
        const now = yield* DateTime.now;
        const since = DateTime.subtract(DateTime.startOf(now, "day"), {
          days: activityWindowDays - 1,
        });
        const [billingSnapshot, resources, counts, recent] = yield* Effect.all(
          [
            billing.get(organizationId),
            repository.core.dashboardOverview.getResources(organizationId),
            repository.core.dashboardOverview.getActivity(organizationId, since),
            execution.list({ organizationId }),
          ],
          { concurrency: "unbounded" },
        );
        const mainnetExecutions = meterUsage(billingSnapshot, "execution.mainnet");
        const sponsoredGasMicroUsd = meterUsage(billingSnapshot, "gas-sponsorship");
        const attention: DashboardOverviewAttentionItem[] = [];
        if (resources.accounts.withoutActiveSessionKeys > 0) {
          attention.push({
            code: "accounts-without-session-keys",
            severity: "info",
            count: resources.accounts.withoutActiveSessionKeys,
            message: `${resources.accounts.withoutActiveSessionKeys} active account${resources.accounts.withoutActiveSessionKeys === 1 ? " has" : "s have"} no active session key.`,
            href: "/accounts",
          });
        }
        const mainnetAttention = usageAttention(
          "mainnet-executions-near-limit",
          "Mainnet executions",
          mainnetExecutions,
          "/settings/workspace/billings",
        );
        if (mainnetAttention !== undefined) attention.push(mainnetAttention);
        const gasAttention = usageAttention(
          "sponsored-gas-near-limit",
          "Sponsored gas",
          sponsoredGasMicroUsd,
          "/settings/workspace/billings",
        );
        if (gasAttention !== undefined) attention.push(gasAttention);

        yield* Metric.update(dashboardOverviewReads, 1);
        return {
          organizationId,
          period: {
            startsAt: billingSnapshot.period.startsAt,
            endsAt: billingSnapshot.period.endsAt,
          },
          resources: {
            accounts: {
              ...resources.accounts,
              included: Number(
                billingSnapshot.resources
                  .filter(({ key }) => key === "software-wallets" || key === "hsm-wallets")
                  .reduce((sum, resource) => sum + resource.includedAmount, 0n),
              ),
            },
            sessionKeys: resources.sessionKeys,
          },
          namespaces: [
            {
              namespace: "eip155" as const,
              usage: {
                mainnetExecutions,
                testnetExecutions: meterUsage(billingSnapshot, "execution.testnet"),
                signatures: meterUsage(billingSnapshot, "signature"),
                sponsoredGasMicroUsd,
              },
              activity: {
                windowDays: activityWindowDays,
                series: activitySeries(now, counts),
              },
            },
          ],
          recentExecutions: recent.items.slice(0, recentExecutionLimit),
          attention,
        } satisfies GetDashboardOverviewResponse;
      },
      Effect.trackDuration(dashboardOverviewReadDuration),
      Effect.catchTag("DatabaseError", Effect.die),
    );

    return { get } satisfies DashboardOverviewApplication;
  });
