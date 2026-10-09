import type { CredentialId, OrganizationId } from "@namera-ai/protocol";
import type { Credential } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, jsonb, text, uniqueIndex } from "drizzle-orm/pg-core";

import { generateUniqueId, timestamps } from "#/schema/common";

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
    ...timestamps,
  },
  (table) => [
    uniqueIndex("credentials_id_organization_uidx").on(table.id, table.organizationId),
    uniqueIndex("credentials_organization_agent_uidx")
      .on(table.organizationId, table.type, sql`(${table.data}->>'agentId')`)
      .where(sql`${table.type} = '1claw-agent'`),
    check("credentials_type_check", sql`${table.type} IN ('1claw-agent')`),
    check(
      "credentials_data_check",
      sql`(
    jsonb_typeof(${table.data}) = 'object'
    AND ${table.data}->'version' = '1'::jsonb
    AND jsonb_typeof(${table.data}->'agentId') = 'string'
    AND length(${table.data}->>'agentId') > 0
  ) IS TRUE`,
    ),
    check("credentials_encrypted_payload_check", sql`length(${table.encryptedPayload}) > 0`),
  ],
);
