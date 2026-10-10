import type { CredentialId, OrganizationId, ProviderConnectionId } from "@namera-ai/protocol";
import type { ProviderConnectionEncoded } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, foreignKey, jsonb, text, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId, timestamps } from "#/schema/common";

import { organization } from "../auth/organization/organization.js";
import { coreSchema } from "./common.js";
import { credentials } from "./credentials.js";

export const providerConnections = coreSchema.table(
  "provider_connections",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<ProviderConnectionId>(),
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "restrict" }),
    provider: text("provider").notNull().$type<"1claw">(),
    providerAppId: text("provider_app_id").notNull(),
    externalConnectionId: text("external_connection_id"),
    customerCredentialId: text("customer_credential_id").$type<CredentialId>(),
    status: text("status").notNull().$type<ProviderConnectionEncoded["status"]>(),
    data: jsonb("data").notNull().$type<ProviderConnectionEncoded["data"]>(),
    leaseToken: text("lease_token"),
    leaseExpiresAt: createTimestampField("lease_expires_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("provider_connections_id_org_uidx").on(table.id, table.organizationId),
    uniqueIndex("provider_connections_org_app_uidx").on(
      table.organizationId,
      table.provider,
      table.providerAppId,
    ),
    uniqueIndex("provider_connections_remote_uidx").on(
      table.provider,
      table.providerAppId,
      table.externalConnectionId,
    ),
    uniqueIndex("provider_connections_subject_uidx").on(
      table.provider,
      table.providerAppId,
      sql`(${table.data}->>'oidcSubject')`,
    ),
    foreignKey({
      name: "provider_connections_credential_org_fk",
      columns: [table.customerCredentialId, table.organizationId],
      foreignColumns: [credentials.id, credentials.organizationId],
    }).onDelete("restrict"),
    check(
      "provider_connections_provider_check",
      sql`${table.provider} = '1claw' AND length(${table.providerAppId}) > 0`,
    ),
    check(
      "provider_connections_status_check",
      sql`${table.status} IN ('pending', 'ready', 'disabled')`,
    ),
    check(
      "provider_connections_lease_check",
      sql`((${table.leaseToken} IS NULL AND ${table.leaseExpiresAt} IS NULL) OR (length(${table.leaseToken}) > 0 AND ${table.leaseExpiresAt} IS NOT NULL)) IS TRUE`,
    ),
    check(
      "provider_connections_data_check",
      sql`(
    jsonb_typeof(${table.data}) = 'object' AND ${table.data}->'version' = '1'::jsonb
    AND jsonb_typeof(${table.data}->'oidcSubject') = 'string' AND length(${table.data}->>'oidcSubject') > 0
    AND jsonb_typeof(${table.data}->'email') = 'string' AND ${table.data}->>'email' LIKE '%@%'
    AND ((${table.externalConnectionId} IS NULL AND ${table.data}->'customerId' = 'null'::jsonb)
      OR (length(${table.externalConnectionId}) > 0 AND jsonb_typeof(${table.data}->'customerId') = 'string' AND length(${table.data}->>'customerId') > 0))
    AND (${table.data}->'bootstrapCompletedAt' = 'null'::jsonb OR (jsonb_typeof(${table.data}->'bootstrapCompletedAt') = 'string' AND length(${table.data}->>'bootstrapCompletedAt') > 0 AND ${table.externalConnectionId} IS NOT NULL))
    AND (${table.data}->'delegationEnabledAt' = 'null'::jsonb OR (jsonb_typeof(${table.data}->'delegationEnabledAt') = 'string' AND length(${table.data}->>'delegationEnabledAt') > 0 AND ${table.customerCredentialId} IS NOT NULL AND ${table.data}->>'bootstrapCompletedAt' IS NOT NULL))
  ) IS TRUE`,
    ),
    check(
      "provider_connections_ready_check",
      sql`${table.status} <> 'ready' OR (${table.externalConnectionId} IS NOT NULL AND ${table.customerCredentialId} IS NOT NULL AND ${table.data}->>'bootstrapCompletedAt' IS NOT NULL AND ${table.data}->>'delegationEnabledAt' IS NOT NULL)`,
    ),
  ],
);
