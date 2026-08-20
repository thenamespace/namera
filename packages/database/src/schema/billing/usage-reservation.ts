import type {
  BillingPeriodId,
  BillingUsageReservationId,
  OrganizationId,
} from "@namera-ai/protocol";
import type { BillingUsageReservation } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { bigint, check, foreignKey, index, integer, text, unique } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId, timestamps } from "#/schema/common";

import { billingSchema } from "./common.js";
import { billingPeriod } from "./period.js";

export const billingUsageReservation = billingSchema.table(
  "usage_reservation",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<BillingUsageReservationId>(),
    organizationId: text("organization_id").notNull().$type<OrganizationId>(),
    periodId: text("period_id").notNull().$type<BillingPeriodId>(),
    meterKey: text("meter_key").notNull().$type<BillingUsageReservation["meterKey"]>(),
    meterVersion: integer("meter_version").notNull(),
    unit: text("unit").notNull().$type<BillingUsageReservation["unit"]>(),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    sourceType: text("source_type").notNull().$type<BillingUsageReservation["sourceType"]>(),
    sourceId: text("source_id").notNull(),
    status: text("status").notNull().default("active").$type<BillingUsageReservation["status"]>(),
    expiresAt: createTimestampField("expires_at").notNull(),
    settledAt: createTimestampField("settled_at"),
    releasedAt: createTimestampField("released_at"),
    ...timestamps,
  },
  (table) => [
    unique("billing_usage_reservation_id_organization_unique").on(table.id, table.organizationId),
    unique("billing_usage_reservation_settlement_reference_unique").on(
      table.id,
      table.organizationId,
      table.periodId,
      table.meterKey,
    ),
    unique("billing_usage_reservation_source_unique").on(
      table.periodId,
      table.meterKey,
      table.sourceType,
      table.sourceId,
    ),
    foreignKey({
      name: "billing_usage_reservation_period_organization_fk",
      columns: [table.periodId, table.organizationId],
      foreignColumns: [billingPeriod.id, billingPeriod.organizationId],
    }).onDelete("restrict"),
    index("billing_usage_reservation_organization_period_status_idx").on(
      table.organizationId,
      table.periodId,
      table.status,
    ),
    index("billing_usage_reservation_status_expires_at_idx").on(table.status, table.expiresAt),
    check("billing_usage_reservation_version_check", sql`${table.meterVersion} >= 1`),
    check("billing_usage_reservation_amount_check", sql`${table.amount} > 0`),
    check(
      "billing_usage_reservation_lifecycle_check",
      sql`(${table.status} = 'active' AND ${table.settledAt} IS NULL AND ${table.releasedAt} IS NULL) OR (${table.status} = 'settled' AND ${table.settledAt} IS NOT NULL AND ${table.releasedAt} IS NULL) OR (${table.status} IN ('released', 'expired') AND ${table.settledAt} IS NULL AND ${table.releasedAt} IS NOT NULL)`,
    ),
  ],
);
