import type {
  BillingSubscriptionId,
  BillingSubscriptionItemId,
  OrganizationId,
} from "@namera-ai/protocol";
import type { BillingSubscriptionItem } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { bigint, check, foreignKey, index, text, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId, timestamps } from "#/schema/common";

import { billingSchema } from "./common.js";
import { billingSubscription } from "./subscription.js";

export const billingSubscriptionItem = billingSchema.table(
  "subscription_item",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<BillingSubscriptionItemId>(),
    organizationId: text("organization_id").notNull().$type<OrganizationId>(),
    subscriptionId: text("subscription_id").notNull().$type<BillingSubscriptionId>(),
    componentKey: text("component_key").notNull().$type<BillingSubscriptionItem["componentKey"]>(),
    billingMode: text("billing_mode").notNull().$type<BillingSubscriptionItem["billingMode"]>(),
    provider: text("provider").notNull().$type<BillingSubscriptionItem["provider"]>(),
    providerSubscriptionItemId: text("provider_subscription_item_id").notNull(),
    providerPriceId: text("provider_price_id").notNull(),
    quantity: bigint("quantity", { mode: "bigint" }),
    status: text("status").notNull().default("active").$type<BillingSubscriptionItem["status"]>(),
    removedAt: createTimestampField("removed_at"),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      name: "billing_subscription_item_subscription_organization_fk",
      columns: [table.subscriptionId, table.organizationId],
      foreignColumns: [billingSubscription.id, billingSubscription.organizationId],
    }).onDelete("restrict"),
    uniqueIndex("billing_subscription_item_provider_item_uidx").on(
      table.provider,
      table.providerSubscriptionItemId,
    ),
    uniqueIndex("billing_subscription_item_active_component_uidx")
      .on(table.subscriptionId, table.componentKey)
      .where(sql`${table.status} = 'active'`),
    index("billing_subscription_item_organization_component_idx").on(
      table.organizationId,
      table.componentKey,
    ),
    check(
      "billing_subscription_item_mode_quantity_check",
      sql`(${table.billingMode} = 'licensed' AND ${table.quantity} IS NOT NULL AND ${table.quantity} >= 0) OR (${table.billingMode} = 'metered' AND ${table.quantity} IS NULL)`,
    ),
    check(
      "billing_subscription_item_lifecycle_check",
      sql`(${table.status} = 'active' AND ${table.removedAt} IS NULL) OR (${table.status} = 'removed' AND ${table.removedAt} IS NOT NULL)`,
    ),
  ],
);
