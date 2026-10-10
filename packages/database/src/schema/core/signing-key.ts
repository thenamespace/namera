import type {
  CredentialId,
  OrganizationId,
  ProviderConnectionId,
  SigningKeyId,
} from "@namera-ai/protocol";
import type { SigningKey, SigningKeyEncoded } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, foreignKey, index, jsonb, text, uniqueIndex } from "drizzle-orm/pg-core";

import { generateUniqueId, timestamps } from "#/schema/common";

import { organization } from "../auth/organization/organization.js";
import { coreSchema } from "./common.js";
import { credentials } from "./credentials.js";
import { providerConnections } from "./provider-connections.js";

export const signingKey = coreSchema.table(
  "signing_key",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<SigningKeyId>(),
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "restrict" }),
    purpose: text("purpose").notNull().$type<SigningKey["purpose"]>(),
    credentialId: text("credential_id").$type<CredentialId>(),
    providerConnectionId: text("provider_connection_id").$type<ProviderConnectionId>(),
    custody: text("custody").notNull().$type<SigningKey["custody"]>(),
    algorithm: text("algorithm").notNull().$type<SigningKey["algorithm"]>(),
    publicKeyHex: text("public_key_hex").notNull().$type<SigningKey["publicKeyHex"]>(),
    status: text("status").notNull().default("active").$type<SigningKey["status"]>(),
    data: jsonb("data").notNull().$type<SigningKeyEncoded["data"]>(),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      name: "signing_key_connection_org_fk",
      columns: [table.providerConnectionId, table.organizationId],
      foreignColumns: [providerConnections.id, providerConnections.organizationId],
    }).onDelete("restrict"),
    index("signing_key_connection_idx").on(table.providerConnectionId, table.organizationId),
    check(
      "signing_key_connection_provider_check",
      sql`${table.providerConnectionId} IS NULL OR ${table.data}->>'type' = '1claw'`,
    ),
    foreignKey({
      name: "signing_key_credential_organization_fk",
      columns: [table.credentialId, table.organizationId],
      foreignColumns: [credentials.id, credentials.organizationId],
    }).onDelete("restrict"),
    index("signing_key_credential_organization_idx").on(table.credentialId, table.organizationId),
    uniqueIndex("signing_key_organization_oneclaw_key_uidx")
      .on(
        table.organizationId,
        sql`(${table.data}->>'agentId')`,
        sql`(${table.data}->>'providerKeyId')`,
        sql`((${table.data}->>'keyVersion')::numeric)`,
      )
      .where(sql`${table.data}->>'type' = '1claw'`),
    uniqueIndex("signing_key_id_organization_uidx").on(table.id, table.organizationId),
    uniqueIndex("signing_key_organization_public_key_uidx").on(
      table.organizationId,
      table.algorithm,
      table.publicKeyHex,
    ),
    index("signing_key_organization_purpose_status_idx").on(
      table.organizationId,
      table.purpose,
      table.status,
    ),
    check("signing_key_purpose_check", sql`${table.purpose} IN ('wallet-root', 'session')`),
    check("signing_key_custody_check", sql`${table.custody} IN ('local', 'namera-managed')`),
    check(
      "signing_key_algorithm_check",
      sql`${table.algorithm} IN ('p256', 'secp256k1', 'ed25519')`,
    ),
    check("signing_key_status_check", sql`${table.status} IN ('active', 'disabled', 'destroyed')`),
    check(
      "signing_key_public_key_hex_check",
      sql`${table.publicKeyHex} ~ '^0x[0-9a-f]+$' AND mod(length(${table.publicKeyHex}) - 2, 2) = 0`,
    ),
    check("signing_key_data_object_check", sql`jsonb_typeof(${table.data}) = 'object'`),
    check(
      "signing_key_data_type_check",
      sql`${table.data}->>'type' IS NOT NULL AND ${table.data}->>'type' IN ('passkey', 'local-key', 'gcp-kms', 'local-provider', '1claw')`,
    ),
    check(
      "signing_key_custody_data_check",
      sql`(${table.custody} = 'local' AND ${table.data}->>'type' IN ('passkey', 'local-key')) OR (${table.custody} = 'namera-managed' AND ${table.data}->>'type' IN ('gcp-kms', 'local-provider', '1claw'))`,
    ),
    check(
      "signing_key_credential_check",
      sql`(
      (${table.data}->>'type' = '1claw' AND ${table.credentialId} IS NOT NULL)
      OR (${table.data}->>'type' <> '1claw' AND ${table.credentialId} IS NULL)
    ) IS TRUE`,
    ),
    check(
      "signing_key_oneclaw_data_check",
      sql`${table.data}->>'type' <> '1claw' OR (
      ${table.data}->'version' = '1'::jsonb
      AND jsonb_typeof(${table.data}->'agentId') = 'string'
      AND length(${table.data}->>'agentId') > 0
      AND jsonb_typeof(${table.data}->'providerKeyId') = 'string'
      AND length(${table.data}->>'providerKeyId') > 0
      AND CASE WHEN jsonb_typeof(${table.data}->'keyVersion') = 'number'
        THEN (${table.data}->>'keyVersion')::numeric >= 1
          AND trunc((${table.data}->>'keyVersion')::numeric) = (${table.data}->>'keyVersion')::numeric
        ELSE false END
      AND (
        (${table.algorithm} = 'secp256k1' AND ${table.data}->>'chain' IN ('ethereum', 'bitcoin', 'tron'))
        OR (${table.algorithm} = 'ed25519' AND ${table.data}->>'chain' IN ('solana', 'xrp', 'cardano'))
      )
    ) IS TRUE`,
    ),
    check(
      "signing_key_passkey_check",
      sql`${table.data}->>'type' <> 'passkey' OR (${table.purpose} = 'wallet-root' AND ${table.algorithm} = 'p256')`,
    ),
  ],
);
