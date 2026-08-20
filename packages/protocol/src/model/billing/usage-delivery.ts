import { Schema, Struct } from "effect";

import { BillingUsageDeliveryId, BillingUsageEventId, OrganizationId } from "#/common/index";
import { NonEmptyString, TimestampFields } from "#/model/common";
import { createInsertSchema, createUpdateSchema } from "#/model/helpers";

import { BillingProvider } from "./common.js";

export const BillingUsageDeliveryStatus = Schema.Literals([
  "pending",
  "retrying",
  "delivered",
  "failed",
]);

export const BillingUsageDelivery = Schema.Struct({
  id: BillingUsageDeliveryId,
  organizationId: OrganizationId,
  usageEventId: BillingUsageEventId,
  provider: BillingProvider,
  destination: NonEmptyString,
  providerCustomerId: NonEmptyString,
  idempotencyKey: NonEmptyString,
  providerUsageId: Schema.NullOr(NonEmptyString),
  status: BillingUsageDeliveryStatus,
  attempts: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  nextAttemptAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  lastError: Schema.NullOr(Schema.String),
  deliveredAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
}).mapFields(Struct.assign(TimestampFields));

export const BillingUsageDeliveryInsert = createInsertSchema(
  BillingUsageDelivery,
  "organizationId",
  "usageEventId",
  "provider",
  "destination",
  "providerCustomerId",
  "idempotencyKey",
);
export const BillingUsageDeliveryUpdate = createUpdateSchema(BillingUsageDelivery);

export type BillingUsageDeliveryStatus = typeof BillingUsageDeliveryStatus.Type;
export type BillingUsageDelivery = typeof BillingUsageDelivery.Type;
export type BillingUsageDeliveryInsert = typeof BillingUsageDeliveryInsert.Type;
export type BillingUsageDeliveryUpdate = typeof BillingUsageDeliveryUpdate.Type;
