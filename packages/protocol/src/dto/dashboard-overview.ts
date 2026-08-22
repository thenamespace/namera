import { Schema } from "effect";

import { OrganizationId } from "#/common/index";

import { ExecutionListItemResponse } from "./execution.js";

const NonNegativeAmount = Schema.BigIntFromString.check(Schema.isGreaterThanOrEqualToBigInt(0n));
const NonNegativeInt = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

export const DashboardOverviewMeterUsage = Schema.Struct({
  consumedAmount: NonNegativeAmount,
  reservedAmount: NonNegativeAmount,
  limitAmount: Schema.NullOr(NonNegativeAmount),
}).annotate({ identifier: "DashboardOverviewMeterUsage" });

export const DashboardOverviewActivityPoint = Schema.Struct({
  date: Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/)),
  executions: NonNegativeInt,
  failedExecutions: NonNegativeInt,
  signatures: NonNegativeInt,
}).annotate({ identifier: "DashboardOverviewActivityPoint" });

export const EvmDashboardOverview = Schema.Struct({
  namespace: Schema.Literal("eip155"),
  usage: Schema.Struct({
    mainnetExecutions: DashboardOverviewMeterUsage,
    testnetExecutions: DashboardOverviewMeterUsage,
    signatures: DashboardOverviewMeterUsage,
    sponsoredGasMicroUsd: DashboardOverviewMeterUsage,
  }),
  activity: Schema.Struct({
    windowDays: NonNegativeInt,
    series: Schema.Array(DashboardOverviewActivityPoint),
  }),
}).annotate({ identifier: "EvmDashboardOverview" });

export const DashboardNamespaceOverview = Schema.Union([EvmDashboardOverview], {
  mode: "oneOf",
}).annotate({
  identifier: "DashboardNamespaceOverview",
  description: "A namespace-discriminated operational overview",
});

export const DashboardOverviewAttentionCode = Schema.Literals([
  "accounts-without-session-keys",
  "mainnet-executions-near-limit",
  "sponsored-gas-near-limit",
]);

export const DashboardOverviewAttentionItem = Schema.Struct({
  code: DashboardOverviewAttentionCode,
  severity: Schema.Literals(["info", "warning", "critical"]),
  count: NonNegativeInt,
  message: Schema.NonEmptyString,
  href: Schema.optionalKey(Schema.NonEmptyString),
}).annotate({ identifier: "DashboardOverviewAttentionItem" });

export const GetDashboardOverviewResponse = Schema.Struct({
  organizationId: OrganizationId,
  period: Schema.Struct({
    startsAt: Schema.DateTimeUtcFromDate,
    endsAt: Schema.DateTimeUtcFromDate,
  }),
  resources: Schema.Struct({
    accounts: Schema.Struct({
      total: NonNegativeInt,
      active: NonNegativeInt,
      included: NonNegativeInt,
      withoutActiveSessionKeys: NonNegativeInt,
    }),
    sessionKeys: Schema.Struct({
      total: NonNegativeInt,
      active: NonNegativeInt,
    }),
  }),
  namespaces: Schema.Array(DashboardNamespaceOverview),
  recentExecutions: Schema.Array(ExecutionListItemResponse),
  attention: Schema.Array(DashboardOverviewAttentionItem),
}).annotate({
  identifier: "GetDashboardOverviewResponse",
  description: "A compact operational snapshot for the active organization dashboard",
});

export type DashboardOverviewMeterUsage = typeof DashboardOverviewMeterUsage.Type;
export type DashboardOverviewActivityPoint = typeof DashboardOverviewActivityPoint.Type;
export type EvmDashboardOverview = typeof EvmDashboardOverview.Type;
export type DashboardNamespaceOverview = typeof DashboardNamespaceOverview.Type;
export type DashboardOverviewAttentionCode = typeof DashboardOverviewAttentionCode.Type;
export type DashboardOverviewAttentionItem = typeof DashboardOverviewAttentionItem.Type;
export type GetDashboardOverviewResponse = typeof GetDashboardOverviewResponse.Type;
