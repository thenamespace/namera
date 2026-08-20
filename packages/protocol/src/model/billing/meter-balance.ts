import { Schema, Struct } from "effect";

import { BillingPeriodId, OrganizationId } from "#/common/index";
import { TimestampFields } from "#/model/common";
import { createInsertSchema, createUpdateSchema } from "#/model/helpers";

import { BillingMeterKey, BillingMeterUnit } from "./common.js";

const NonNegativeAmount = Schema.BigInt.check(Schema.isGreaterThanOrEqualToBigInt(0n));

export const BillingMeterBalance = Schema.Struct({
  organizationId: OrganizationId,
  periodId: BillingPeriodId,
  meterKey: BillingMeterKey,
  meterVersion: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  unit: BillingMeterUnit,
  includedAmount: NonNegativeAmount,
  hardLimitAmount: Schema.NullOr(NonNegativeAmount),
  consumedAmount: NonNegativeAmount,
  reservedAmount: NonNegativeAmount,
}).mapFields(Struct.assign(TimestampFields));

export const BillingMeterBalanceInsert = createInsertSchema(
  BillingMeterBalance,
  "organizationId",
  "periodId",
  "meterKey",
  "meterVersion",
  "unit",
  "includedAmount",
);
export const BillingMeterBalanceUpdate = createUpdateSchema(BillingMeterBalance);

export type BillingMeterBalance = typeof BillingMeterBalance.Type;
export type BillingMeterBalanceInsert = typeof BillingMeterBalanceInsert.Type;
export type BillingMeterBalanceUpdate = typeof BillingMeterBalanceUpdate.Type;
