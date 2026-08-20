import { Schema, Struct } from "effect";

import { BillingSubscriptionId, BillingSubscriptionItemId, OrganizationId } from "#/common/index";
import { NonEmptyString, TimestampFields } from "#/model/common";
import { createInsertSchema, createUpdateSchema } from "#/model/helpers";

import { BillingProvider, BillingSubscriptionComponentKey } from "./common.js";

export const BillingSubscriptionItemMode = Schema.Literals(["licensed", "metered"]);
export const BillingSubscriptionItemStatus = Schema.Literals(["active", "removed"]);

export const BillingSubscriptionItem = Schema.Struct({
  id: BillingSubscriptionItemId,
  organizationId: OrganizationId,
  subscriptionId: BillingSubscriptionId,
  componentKey: BillingSubscriptionComponentKey,
  billingMode: BillingSubscriptionItemMode,
  provider: BillingProvider,
  providerSubscriptionItemId: NonEmptyString,
  providerPriceId: NonEmptyString,
  quantity: Schema.NullOr(Schema.BigInt.check(Schema.isGreaterThanOrEqualToBigInt(0n))),
  status: BillingSubscriptionItemStatus,
  removedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
}).mapFields(Struct.assign(TimestampFields));

export const BillingSubscriptionItemInsert = createInsertSchema(
  BillingSubscriptionItem,
  "organizationId",
  "subscriptionId",
  "componentKey",
  "billingMode",
  "provider",
  "providerSubscriptionItemId",
  "providerPriceId",
);
export const BillingSubscriptionItemUpdate = createUpdateSchema(BillingSubscriptionItem);

export type BillingSubscriptionItemMode = typeof BillingSubscriptionItemMode.Type;
export type BillingSubscriptionItemStatus = typeof BillingSubscriptionItemStatus.Type;
export type BillingSubscriptionItem = typeof BillingSubscriptionItem.Type;
export type BillingSubscriptionItemInsert = typeof BillingSubscriptionItemInsert.Type;
export type BillingSubscriptionItemUpdate = typeof BillingSubscriptionItemUpdate.Type;
