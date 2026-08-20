import type { BillingPeriodId, OrganizationId } from "@namera-ai/protocol";
import type { BillingMeterBalance } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { bigint, check, foreignKey, index, integer, primaryKey, text } from "drizzle-orm/pg-core";

import { timestamps } from "#/schema/common";

import { billingSchema } from "./common.js";
import { billingPeriod } from "./period.js";

export const billingMeterBalance = billingSchema.table(
  "meter_balance",
  {
    organizationId: text("organization_id").notNull().$type<OrganizationId>(),
    periodId: text("period_id").notNull().$type<BillingPeriodId>(),
    meterKey: text("meter_key").notNull().$type<BillingMeterBalance["meterKey"]>(),
    meterVersion: integer("meter_version").notNull(),
    unit: text("unit").notNull().$type<BillingMeterBalance["unit"]>(),
    includedAmount: bigint("included_amount", { mode: "bigint" }).notNull(),
    hardLimitAmount: bigint("hard_limit_amount", { mode: "bigint" }),
    consumedAmount: bigint("consumed_amount", { mode: "bigint" }).notNull().default(0n),
    reservedAmount: bigint("reserved_amount", { mode: "bigint" }).notNull().default(0n),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      name: "billing_meter_balance_pk",
      columns: [table.periodId, table.meterKey],
    }),
    foreignKey({
      name: "billing_meter_balance_period_organization_fk",
      columns: [table.periodId, table.organizationId],
      foreignColumns: [billingPeriod.id, billingPeriod.organizationId],
    }).onDelete("restrict"),
    index("billing_meter_balance_organization_period_idx").on(table.organizationId, table.periodId),
    check("billing_meter_balance_version_check", sql`${table.meterVersion} >= 1`),
    check(
      "billing_meter_balance_amounts_check",
      sql`${table.includedAmount} >= 0 AND ${table.consumedAmount} >= 0 AND ${table.reservedAmount} >= 0`,
    ),
    check(
      "billing_meter_balance_hard_limit_check",
      sql`${table.hardLimitAmount} IS NULL OR (${table.hardLimitAmount} >= ${table.includedAmount} AND ${table.consumedAmount} + ${table.reservedAmount} <= ${table.hardLimitAmount})`,
    ),
  ],
);
