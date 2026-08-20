import type {
  BillingPeriodId,
  BillingUsageEventId,
  BillingUsageReservationId,
  OrganizationId,
} from "@namera-ai/protocol";
import type { BillingUsageEvent, BillingUsageEventEncoded } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  text,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId } from "#/schema/common";

import { billingSchema } from "./common.js";
import { billingPeriod } from "./period.js";
import { billingUsageReservation } from "./usage-reservation.js";

export const billingUsageEvent = billingSchema.table(
  "usage_event",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<BillingUsageEventId>(),
    organizationId: text("organization_id").notNull().$type<OrganizationId>(),
    periodId: text("period_id").notNull().$type<BillingPeriodId>(),
    meterKey: text("meter_key").notNull().$type<BillingUsageEvent["meterKey"]>(),
    meterVersion: integer("meter_version").notNull(),
    unit: text("unit").notNull().$type<BillingUsageEvent["unit"]>(),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    direction: text("direction").notNull().$type<BillingUsageEvent["direction"]>(),
    sourceType: text("source_type").notNull().$type<BillingUsageEvent["sourceType"]>(),
    sourceId: text("source_id").notNull(),
    reservationId: text("reservation_id").$type<BillingUsageReservationId>(),
    idempotencyKey: text("idempotency_key").notNull(),
    data: jsonb("data").notNull().default({}).$type<BillingUsageEventEncoded["data"]>(),
    reversesUsageEventId: text("reverses_usage_event_id").$type<BillingUsageEventId>(),
    occurredAt: createTimestampField("occurred_at").notNull(),
    createdAt: createTimestampField("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("billing_usage_event_id_organization_unique").on(table.id, table.organizationId),
    foreignKey({
      name: "billing_usage_event_period_organization_fk",
      columns: [table.periodId, table.organizationId],
      foreignColumns: [billingPeriod.id, billingPeriod.organizationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "billing_usage_event_reservation_scope_fk",
      columns: [table.reservationId, table.organizationId, table.periodId, table.meterKey],
      foreignColumns: [
        billingUsageReservation.id,
        billingUsageReservation.organizationId,
        billingUsageReservation.periodId,
        billingUsageReservation.meterKey,
      ],
    }).onDelete("restrict"),
    foreignKey({
      name: "billing_usage_event_reversal_organization_fk",
      columns: [table.reversesUsageEventId, table.organizationId],
      foreignColumns: [table.id, table.organizationId],
    }).onDelete("restrict"),
    unique("billing_usage_event_organization_idempotency_unique").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    uniqueIndex("billing_usage_event_reservation_uidx")
      .on(table.reservationId)
      .where(sql`${table.reservationId} IS NOT NULL`),
    uniqueIndex("billing_usage_event_debit_source_uidx")
      .on(table.periodId, table.meterKey, table.sourceType, table.sourceId)
      .where(sql`${table.direction} = 'debit'`),
    index("billing_usage_event_organization_period_meter_occurred_idx").on(
      table.organizationId,
      table.periodId,
      table.meterKey,
      table.occurredAt.desc(),
    ),
    index("billing_usage_event_source_idx").on(table.sourceType, table.sourceId),
    check("billing_usage_event_version_check", sql`${table.meterVersion} >= 1`),
    check("billing_usage_event_amount_check", sql`${table.amount} > 0`),
    check(
      "billing_usage_event_reversal_check",
      sql`(${table.direction} = 'debit' AND ${table.reversesUsageEventId} IS NULL) OR (${table.direction} = 'credit' AND ${table.reversesUsageEventId} IS NOT NULL)`,
    ),
    check(
      "billing_usage_event_not_self_reversal_check",
      sql`${table.reversesUsageEventId} IS NULL OR ${table.reversesUsageEventId} <> ${table.id}`,
    ),
  ],
);
