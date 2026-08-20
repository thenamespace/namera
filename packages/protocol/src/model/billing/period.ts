import { Schema, Struct } from "effect";

import { BillingPeriodId, BillingSubscriptionId, OrganizationId } from "#/common/index";
import { TimestampFields } from "#/model/common";
import { createInsertSchema, createUpdateSchema } from "#/model/helpers";

import { BillingPlan } from "./common.js";

export const BillingPeriodStatus = Schema.Literals(["open", "closed"]);

export const BillingPeriod = Schema.Struct({
  id: BillingPeriodId,
  organizationId: OrganizationId,
  subscriptionId: BillingSubscriptionId,
  plan: BillingPlan,
  planVersion: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  startsAt: Schema.DateTimeUtcFromDate,
  endsAt: Schema.DateTimeUtcFromDate,
  status: BillingPeriodStatus,
  closedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
}).mapFields(Struct.assign(TimestampFields));

export const BillingPeriodInsert = createInsertSchema(
  BillingPeriod,
  "organizationId",
  "subscriptionId",
  "plan",
  "planVersion",
  "startsAt",
  "endsAt",
);
export const BillingPeriodUpdate = createUpdateSchema(BillingPeriod);

export type BillingPeriodStatus = typeof BillingPeriodStatus.Type;
export type BillingPeriod = typeof BillingPeriod.Type;
export type BillingPeriodInsert = typeof BillingPeriodInsert.Type;
export type BillingPeriodUpdate = typeof BillingPeriodUpdate.Type;
