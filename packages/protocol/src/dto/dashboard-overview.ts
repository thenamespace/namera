import { Schema } from "effect";

import { OrganizationId } from "#/common/index";

const NonNegativeAmount = Schema.BigIntFromString.check(Schema.isGreaterThanOrEqualToBigInt(0n));
const NonNegativeInt = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

export const DashboardOverviewActivityPoint = Schema.Struct({
  date: Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/)),
  executions: NonNegativeInt,
  signatures: NonNegativeInt,
}).annotate({ identifier: "DashboardOverviewActivityPoint" });

export const DashboardOverviewActivitySeries = Schema.Struct({
  granularity: Schema.Literals(["day", "week", "month"]),
  points: Schema.Array(DashboardOverviewActivityPoint),
}).annotate({ identifier: "DashboardOverviewActivitySeries" });

export const EvmDashboardOverview = Schema.Struct({
  namespace: Schema.Literal("eip155"),
  totals: Schema.Struct({
    executions: NonNegativeAmount,
    signatures: NonNegativeAmount,
  }),
  activity: Schema.Struct({
    daily: DashboardOverviewActivitySeries,
    weekly: DashboardOverviewActivitySeries,
    monthly: DashboardOverviewActivitySeries,
  }),
}).annotate({ identifier: "EvmDashboardOverview" });

export const DashboardNamespaceOverview = Schema.Union([EvmDashboardOverview], {
  mode: "oneOf",
}).annotate({
  identifier: "DashboardNamespaceOverview",
  description: "A namespace-discriminated operational overview",
});

export const GetDashboardOverviewResponse = Schema.Struct({
  organizationId: OrganizationId,
  resources: Schema.Struct({
    accounts: Schema.Struct({
      total: NonNegativeInt,
      active: NonNegativeInt,
    }),
    sessionKeys: Schema.Struct({
      total: NonNegativeInt,
      active: NonNegativeInt,
    }),
  }),
  namespaces: Schema.Array(DashboardNamespaceOverview),
}).annotate({
  identifier: "GetDashboardOverviewResponse",
  description: "A compact operational snapshot for the active organization dashboard",
});

export type DashboardOverviewActivityPoint = typeof DashboardOverviewActivityPoint.Type;
export type DashboardOverviewActivitySeries = typeof DashboardOverviewActivitySeries.Type;
export type EvmDashboardOverview = typeof EvmDashboardOverview.Type;
export type DashboardNamespaceOverview = typeof DashboardNamespaceOverview.Type;
export type GetDashboardOverviewResponse = typeof GetDashboardOverviewResponse.Type;
