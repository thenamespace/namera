import type { Email, OrganizationId } from "@namera-ai/protocol";
import type { BillingAccount } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, text, uniqueIndex } from "drizzle-orm/pg-core";

import { timestamps } from "#/schema/common";

import { organization } from "../auth/organization/organization.js";
import { billingSchema } from "./common.js";

export const billingAccount = billingSchema.table(
  "account",
  {
    organizationId: text("organization_id")
      .primaryKey()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "restrict" }),
    provider: text("provider").$type<NonNullable<BillingAccount["provider"]>>(),
    providerCustomerId: text("provider_customer_id"),
    billingEmail: text("billing_email").$type<Email>(),
    currency: text("currency").notNull().default("usd").$type<BillingAccount["currency"]>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("billing_account_provider_customer_uidx")
      .on(table.provider, table.providerCustomerId)
      .where(sql`${table.providerCustomerId} IS NOT NULL`),
    check(
      "billing_account_provider_customer_check",
      sql`(${table.provider} IS NULL AND ${table.providerCustomerId} IS NULL) OR (${table.provider} IS NOT NULL AND ${table.providerCustomerId} IS NOT NULL)`,
    ),
  ],
);
