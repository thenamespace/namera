import { Schema } from "effect";

import {
  BillingPeriodId,
  BillingUsageEventId,
  BillingUsageReservationId,
  OrganizationId,
} from "#/common/index";
import { NonEmptyString } from "#/model/common";
import { createInsertSchema } from "#/model/helpers";

import { BillingMeterKey, BillingMeterUnit, BillingUsageSourceType } from "./common.js";

export const BillingUsageDirection = Schema.Literals(["debit", "credit"]);

export const BillingUsageEvent = Schema.Struct({
  id: BillingUsageEventId,
  organizationId: OrganizationId,
  periodId: BillingPeriodId,
  meterKey: BillingMeterKey,
  meterVersion: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  unit: BillingMeterUnit,
  amount: Schema.BigInt.check(Schema.isGreaterThanBigInt(0n)),
  direction: BillingUsageDirection,
  sourceType: BillingUsageSourceType,
  sourceId: NonEmptyString,
  reservationId: Schema.NullOr(BillingUsageReservationId),
  idempotencyKey: NonEmptyString,
  data: Schema.Json,
  reversesUsageEventId: Schema.NullOr(BillingUsageEventId),
  occurredAt: Schema.DateTimeUtcFromDate,
  createdAt: Schema.DateTimeUtcFromDate,
});

export const BillingUsageEventInsert = createInsertSchema(
  BillingUsageEvent,
  "organizationId",
  "periodId",
  "meterKey",
  "meterVersion",
  "unit",
  "amount",
  "direction",
  "sourceType",
  "sourceId",
  "idempotencyKey",
  "data",
  "occurredAt",
);

export type BillingUsageDirection = typeof BillingUsageDirection.Type;
export type BillingUsageEvent = typeof BillingUsageEvent.Type;
export type BillingUsageEventEncoded = typeof BillingUsageEvent.Encoded;
export type BillingUsageEventInsert = typeof BillingUsageEventInsert.Type;
