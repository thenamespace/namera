import type { CredentialId, OrganizationId } from "@namera-ai/protocol";
import type { Credential } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, jsonb, text, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId, timestamps } from "#/schema/common";

import { organization } from "../auth/organization/organization.js";
import { coreSchema } from "./common.js";

export const credentials = coreSchema.table(
  "credentials",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<CredentialId>(),
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "restrict" }),
    type: text("type").notNull().$type<Credential["type"]>(),
    data: jsonb("data").notNull().$type<Credential["data"]>(),
    encryptedPayload: text("encrypted_payload").notNull(),
    expiresAt: createTimestampField("expires_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("credentials_id_organization_uidx").on(table.id, table.organizationId),
    uniqueIndex("credentials_organization_agent_uidx")
      .on(table.organizationId, table.type, sql`(${table.data}->>'agentId')`)
      .where(sql`${table.type} = '1claw-agent'`),
    uniqueIndex("credentials_customer_connection_uidx")
      .on(sql`(${table.data}->>'providerConnectionId')`)
      .where(sql`${table.type} = '1claw-customer'`),
    check("credentials_type_check", sql`${table.type} IN ('1claw-agent', '1claw-customer')`),
    check(
      "credentials_data_check",
      sql`(
    jsonb_typeof(${table.data}) = 'object'
    AND ${table.data}->'version' = '1'::jsonb
    AND ((${table.type} = '1claw-agent' AND jsonb_typeof(${table.data}->'agentId') = 'string'
    AND length(${table.data}->>'agentId') > 0
    AND ${table.expiresAt} IS NULL)
    OR (${table.type} = '1claw-customer' AND ${table.expiresAt} IS NOT NULL
      AND jsonb_typeof(${table.data}->'providerConnectionId') = 'string'
      AND (${table.data}->>'providerConnectionId') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND jsonb_typeof(${table.data}->'providerAppId') = 'string' AND length(${table.data}->>'providerAppId') > 0
      AND jsonb_typeof(${table.data}->'externalConnectionId') = 'string' AND length(${table.data}->>'externalConnectionId') > 0
      AND jsonb_typeof(${table.data}->'customerId') = 'string' AND length(${table.data}->>'customerId') > 0))
  ) IS TRUE`,
    ),
    check("credentials_encrypted_payload_check", sql`length(${table.encryptedPayload}) > 0`),
  ],
);
