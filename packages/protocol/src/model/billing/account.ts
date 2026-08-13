import { Schema, Struct } from "effect";

import { Email, OrganizationId } from "#/common/index";
import { NonEmptyString, TimestampFields } from "#/model/common";
import { createInsertSchema, createUpdateSchema } from "#/model/helpers";

import { BillingCurrency, BillingProvider } from "./common.js";

export const BillingAccount = Schema.Struct({
  organizationId: OrganizationId,
  provider: Schema.NullOr(BillingProvider),
  providerCustomerId: Schema.NullOr(NonEmptyString),
  billingEmail: Schema.NullOr(Email),
  currency: BillingCurrency,
}).mapFields(Struct.assign(TimestampFields));

export const BillingAccountInsert = createInsertSchema(BillingAccount, "organizationId");
export const BillingAccountUpdate = createUpdateSchema(BillingAccount);

export type BillingAccount = typeof BillingAccount.Type;
export type BillingAccountInsert = typeof BillingAccountInsert.Type;
export type BillingAccountUpdate = typeof BillingAccountUpdate.Type;
