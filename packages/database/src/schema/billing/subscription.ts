import type { BillingSubscriptionId, OrganizationId } from "@namera-ai/protocol";
import type { BillingSubscription, BillingSubscriptionEncoded } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, text, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId, timestamps } from "#/schema/common";

import { billingAccount } from "./account.js";
import { billingSchema } from "./common.js";

export const billingSubscription = billingSchema.table(
  "subscription",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<BillingSubscriptionId>(),
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => billingAccount.organizationId, { onDelete: "restrict" }),
    provider: text("provider").$type<NonNullable<BillingSubscription["provider"]>>(),
    providerSubscriptionId: text("provider_subscription_id"),
    plan: text("plan").notNull().default("free").$type<BillingSubscription["plan"]>(),
    planVersion: integer("plan_version").notNull().default(1),
    status: text("status").notNull().default("active").$type<BillingSubscription["status"]>(),
    currentPeriodStart: createTimestampField("current_period_start"),
    currentPeriodEnd: createTimestampField("current_period_end"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    endedAt: createTimestampField("ended_at"),
    data: jsonb("data").notNull().default({}).$type<BillingSubscriptionEncoded["data"]>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("billing_subscription_current_organization_uidx")
      .on(table.organizationId)
      .where(sql`${table.status} IN ('trialing', 'active', 'past_due')`),
    uniqueIndex("billing_subscription_provider_subscription_uidx")
      .on(table.provider, table.providerSubscriptionId)
      .where(sql`${table.providerSubscriptionId} IS NOT NULL`),
    index("billing_subscription_organization_created_at_idx").on(
      table.organizationId,
      table.createdAt.desc(),
    ),
    index("billing_subscription_status_period_end_idx").on(table.status, table.currentPeriodEnd),
    check("billing_subscription_plan_version_check", sql`${table.planVersion} >= 1`),
    check(
      "billing_subscription_period_check",
      sql`(${table.currentPeriodStart} IS NULL AND ${table.currentPeriodEnd} IS NULL) OR (${table.currentPeriodStart} IS NOT NULL AND ${table.currentPeriodEnd} IS NOT NULL AND ${table.currentPeriodEnd} > ${table.currentPeriodStart})`,
    ),
    check(
      "billing_subscription_provider_check",
      sql`(${table.provider} IS NULL AND ${table.providerSubscriptionId} IS NULL) OR (${table.provider} IS NOT NULL AND ${table.providerSubscriptionId} IS NOT NULL)`,
    ),
  ],
);
