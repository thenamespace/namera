import { Schema } from "effect";

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

export const AdminOverviewPeriod = Schema.Literals(["7d", "30d", "90d"]);
export type AdminOverviewPeriod = typeof AdminOverviewPeriod.Type;
export const GetAdminOverviewRequest = Schema.Struct({
  period: Schema.optional(AdminOverviewPeriod),
});

export const AdminOverviewCounts = Schema.Struct({
  users: Count,
  waitlist: Count,
  accounts: Count,
  sessionKeys: Count,
  executions: Count,
  signatures: Count,
});
export type AdminOverviewCounts = typeof AdminOverviewCounts.Type;

export const AdminOverviewPoint = Schema.Struct({
  date: Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/)),
  ...AdminOverviewCounts.fields,
});
export type AdminOverviewPoint = typeof AdminOverviewPoint.Type;

export const AdminOverviewState = Schema.Struct({
  pendingWaitlist: Count,
  activeSessionKeys: Count,
  revokedSessionKeys: Count,
});

export const GetAdminOverviewResponse = Schema.Struct({
  generatedAt: Schema.DateTimeUtc,
  period: AdminOverviewPeriod,
  totals: AdminOverviewCounts,
  current: AdminOverviewState,
  periodCounts: AdminOverviewCounts,
  activity: Schema.Array(AdminOverviewPoint),
}).annotate({
  identifier: "GetAdminOverviewResponse",
  description: "Platform totals and UTC daily activity, cached for up to sixty seconds.",
});
export type GetAdminOverviewResponse = typeof GetAdminOverviewResponse.Type;
