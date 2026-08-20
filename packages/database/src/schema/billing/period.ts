import type { BillingPeriodId, BillingSubscriptionId, OrganizationId } from "@namera-ai/protocol";
import type { BillingPeriod } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, text, unique, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId, timestamps } from "#/schema/common";

import { billingSchema } from "./common.js";
import { billingSubscription } from "./subscription.js";

export const billingPeriod = billingSchema.table(
  "period",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<BillingPeriodId>(),
    organizationId: text("organization_id").notNull().$type<OrganizationId>(),
    subscriptionId: text("subscription_id").notNull().$type<BillingSubscriptionId>(),
    plan: text("plan").notNull().$type<BillingPeriod["plan"]>(),
    planVersion: integer("plan_version").notNull(),
    startsAt: createTimestampField("starts_at").notNull(),
    endsAt: createTimestampField("ends_at").notNull(),
    status: text("status").notNull().default("open").$type<BillingPeriod["status"]>(),
    closedAt: createTimestampField("closed_at"),
    ...timestamps,
  },
  (table) => [
    unique("billing_period_id_organization_unique").on(table.id, table.organizationId),
    foreignKey({
      name: "billing_period_subscription_organization_fk",
      columns: [table.subscriptionId, table.organizationId],
      foreignColumns: [billingSubscription.id, billingSubscription.organizationId],
    }).onDelete("restrict"),
    unique("billing_period_subscription_window_unique").on(
      table.subscriptionId,
      table.startsAt,
      table.endsAt,
    ),
    uniqueIndex("billing_period_open_organization_uidx")
      .on(table.organizationId)
      .where(sql`${table.status} = 'open'`),
    index("billing_period_organization_starts_at_idx").on(
      table.organizationId,
      table.startsAt.desc(),
    ),
    index("billing_period_status_ends_at_idx").on(table.status, table.endsAt),
    check("billing_period_plan_version_check", sql`${table.planVersion} >= 1`),
    check("billing_period_window_check", sql`${table.endsAt} > ${table.startsAt}`),
    check(
      "billing_period_lifecycle_check",
      sql`(${table.status} = 'open' AND ${table.closedAt} IS NULL) OR (${table.status} = 'closed' AND ${table.closedAt} IS NOT NULL)`,
    ),
  ],
);
