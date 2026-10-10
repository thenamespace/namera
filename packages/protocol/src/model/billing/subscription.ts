import { Schema, Struct } from "effect";

import { BillingSubscriptionId, OrganizationId } from "#/common/index";
import { NonEmptyString, TimestampFields } from "#/model/common";
import { createInsertSchema, createUpdateSchema } from "#/model/helpers";

import { BillingPlan, BillingProvider } from "./common.js";

export const BillingSubscriptionStatus = Schema.Literals([
  "trialing",
  "active",
  "past_due",
  "canceled",
  "ended",
]);

/** Deployment migration marker; absent on newly created Free v2 subscriptions. */
export const FreeBillingRolloutData = Schema.Struct({
  freeV2RolloutAt: Schema.optionalKey(Schema.DateTimeUtcFromString),
});

export const BillingSubscription = Schema.Struct({
  id: BillingSubscriptionId,
  organizationId: OrganizationId,
  provider: Schema.NullOr(BillingProvider),
  providerSubscriptionId: Schema.NullOr(NonEmptyString),
  plan: BillingPlan,
  planVersion: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  status: BillingSubscriptionStatus,
  currentPeriodStart: Schema.NullOr(Schema.DateTimeUtcFromDate),
  currentPeriodEnd: Schema.NullOr(Schema.DateTimeUtcFromDate),
  cancelAtPeriodEnd: Schema.Boolean,
  endedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  data: Schema.Json,
}).mapFields(Struct.assign(TimestampFields));

export const BillingSubscriptionInsert = createInsertSchema(
  BillingSubscription,
  "organizationId",
  "plan",
  "planVersion",
  "data",
);
export const BillingSubscriptionUpdate = createUpdateSchema(BillingSubscription);

export type BillingSubscriptionStatus = typeof BillingSubscriptionStatus.Type;
export type BillingSubscription = typeof BillingSubscription.Type;
export type BillingSubscriptionEncoded = typeof BillingSubscription.Encoded;
export type BillingSubscriptionInsert = typeof BillingSubscriptionInsert.Type;
export type BillingSubscriptionUpdate = typeof BillingSubscriptionUpdate.Type;
