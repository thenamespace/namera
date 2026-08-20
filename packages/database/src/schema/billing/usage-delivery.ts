import type {
  BillingUsageDeliveryId,
  BillingUsageEventId,
  OrganizationId,
} from "@namera-ai/protocol";
import type { BillingUsageDelivery } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, text, unique } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId, timestamps } from "#/schema/common";

import { billingSchema } from "./common.js";
import { billingUsageEvent } from "./usage-event.js";

export const billingUsageDelivery = billingSchema.table(
  "usage_delivery",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<BillingUsageDeliveryId>(),
    organizationId: text("organization_id").notNull().$type<OrganizationId>(),
    usageEventId: text("usage_event_id").notNull().$type<BillingUsageEventId>(),
    provider: text("provider").notNull().$type<BillingUsageDelivery["provider"]>(),
    destination: text("destination").notNull(),
    providerCustomerId: text("provider_customer_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    providerUsageId: text("provider_usage_id"),
    status: text("status").notNull().default("pending").$type<BillingUsageDelivery["status"]>(),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: createTimestampField("next_attempt_at"),
    lastError: text("last_error"),
    deliveredAt: createTimestampField("delivered_at"),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      name: "billing_usage_delivery_event_organization_fk",
      columns: [table.usageEventId, table.organizationId],
      foreignColumns: [billingUsageEvent.id, billingUsageEvent.organizationId],
    }).onDelete("restrict"),
    unique("billing_usage_delivery_event_destination_unique").on(
      table.usageEventId,
      table.provider,
      table.destination,
    ),
    unique("billing_usage_delivery_provider_idempotency_unique").on(
      table.provider,
      table.idempotencyKey,
    ),
    index("billing_usage_delivery_status_next_attempt_idx").on(table.status, table.nextAttemptAt),
    index("billing_usage_delivery_organization_created_at_idx").on(
      table.organizationId,
      table.createdAt.desc(),
    ),
    check("billing_usage_delivery_attempts_check", sql`${table.attempts} >= 0`),
    check(
      "billing_usage_delivery_lifecycle_check",
      sql`(${table.status} = 'delivered' AND ${table.deliveredAt} IS NOT NULL) OR (${table.status} IN ('pending', 'retrying', 'failed') AND ${table.deliveredAt} IS NULL)`,
    ),
  ],
);
