import { Schema, Struct } from "effect";

import { BillingPeriodId, BillingUsageReservationId, OrganizationId } from "#/common/index";
import { NonEmptyString, TimestampFields } from "#/model/common";
import { createInsertSchema, createUpdateSchema } from "#/model/helpers";

import { BillingMeterKey, BillingMeterUnit, BillingUsageSourceType } from "./common.js";

export const BillingUsageReservationStatus = Schema.Literals([
  "active",
  "settled",
  "released",
  "expired",
]);

export const BillingUsageReservation = Schema.Struct({
  id: BillingUsageReservationId,
  organizationId: OrganizationId,
  periodId: BillingPeriodId,
  meterKey: BillingMeterKey,
  meterVersion: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  unit: BillingMeterUnit,
  amount: Schema.BigInt.check(Schema.isGreaterThanBigInt(0n)),
  sourceType: BillingUsageSourceType,
  sourceId: NonEmptyString,
  status: BillingUsageReservationStatus,
  expiresAt: Schema.DateTimeUtcFromDate,
  settledAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  releasedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
}).mapFields(Struct.assign(TimestampFields));

export const BillingUsageReservationInsert = createInsertSchema(
  BillingUsageReservation,
  "organizationId",
  "periodId",
  "meterKey",
  "meterVersion",
  "unit",
  "amount",
  "sourceType",
  "sourceId",
  "expiresAt",
);
export const BillingUsageReservationUpdate = createUpdateSchema(BillingUsageReservation);

export type BillingUsageReservationStatus = typeof BillingUsageReservationStatus.Type;
export type BillingUsageReservation = typeof BillingUsageReservation.Type;
export type BillingUsageReservationInsert = typeof BillingUsageReservationInsert.Type;
export type BillingUsageReservationUpdate = typeof BillingUsageReservationUpdate.Type;
