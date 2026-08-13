import { Schema, Struct } from "effect";

import { BillingProviderEventId } from "#/common/index";
import { NonEmptyString, TimestampFields } from "#/model/common";
import { createInsertSchema, createUpdateSchema } from "#/model/helpers";

import { BillingProvider } from "./common.js";

export const BillingProviderEventStatus = Schema.Literals(["pending", "processed", "failed"]);

export const BillingProviderEvent = Schema.Struct({
  id: BillingProviderEventId,
  provider: BillingProvider,
  providerEventId: NonEmptyString,
  type: NonEmptyString,
  livemode: Schema.Boolean,
  data: Schema.Json,
  status: BillingProviderEventStatus,
  attempts: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  providerCreatedAt: Schema.DateTimeUtcFromDate,
  processedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  lastError: Schema.NullOr(Schema.String),
}).mapFields(Struct.assign(TimestampFields));

export const BillingProviderEventInsert = createInsertSchema(
  BillingProviderEvent,
  "provider",
  "providerEventId",
  "type",
  "livemode",
  "data",
  "providerCreatedAt",
);
export const BillingProviderEventUpdate = createUpdateSchema(BillingProviderEvent);

export type BillingProviderEventStatus = typeof BillingProviderEventStatus.Type;
export type BillingProviderEvent = typeof BillingProviderEvent.Type;
export type BillingProviderEventEncoded = typeof BillingProviderEvent.Encoded;
export type BillingProviderEventInsert = typeof BillingProviderEventInsert.Type;
export type BillingProviderEventUpdate = typeof BillingProviderEventUpdate.Type;
