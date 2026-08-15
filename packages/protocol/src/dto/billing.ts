import { Schema } from "effect";

import { OrganizationId } from "#/common/index";
import { BillingPlan, BillingPlanLimits, BillingSubscriptionStatus } from "#/model/index";

export const BillingUsage = Schema.Struct({
  members: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  pendingInvitations: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  softwareWallets: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  hsmWallets: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  executions: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
}).annotate({ identifier: "BillingUsage" });

export const GetBillingResponse = Schema.Struct({
  organizationId: OrganizationId,
  plan: BillingPlan,
  planVersion: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  status: BillingSubscriptionStatus,
  limits: BillingPlanLimits,
  usage: BillingUsage,
}).annotate({
  identifier: "GetBillingResponse",
  description: "Current billing plan, limits, and usage for the active organization",
});

export type BillingUsage = typeof BillingUsage.Type;
export type GetBillingResponse = typeof GetBillingResponse.Type;
