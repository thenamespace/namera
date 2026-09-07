import type { OrganizationId, SigningKeyId } from "@namera-ai/protocol";
import type { SigningKey, SigningKeyEncoded } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, index, jsonb, text, uniqueIndex } from "drizzle-orm/pg-core";

import { generateUniqueId, timestamps } from "#/schema/common";

import { organization } from "../auth/organization/organization.js";
import { coreSchema } from "./common.js";

export const signingKey = coreSchema.table(
  "signing_key",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<SigningKeyId>(),
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "restrict" }),
    purpose: text("purpose").notNull().$type<SigningKey["purpose"]>(),
    custody: text("custody").notNull().$type<SigningKey["custody"]>(),
    algorithm: text("algorithm").notNull().$type<SigningKey["algorithm"]>(),
    publicKeyHex: text("public_key_hex").notNull().$type<SigningKey["publicKeyHex"]>(),
    status: text("status").notNull().default("active").$type<SigningKey["status"]>(),
    data: jsonb("data").notNull().$type<SigningKeyEncoded["data"]>(),
    ...timestamps,
  },
  (table) => [
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
      sql`${table.data}->>'type' IS NOT NULL AND ${table.data}->>'type' IN ('passkey', 'local-key', 'gcp-kms', 'local-provider')`,
    ),
    check(
      "signing_key_custody_data_check",
      sql`(${table.custody} = 'local' AND ${table.data}->>'type' IN ('passkey', 'local-key')) OR (${table.custody} = 'namera-managed' AND ${table.data}->>'type' IN ('gcp-kms', 'local-provider'))`,
    ),
    check(
      "signing_key_passkey_check",
      sql`${table.data}->>'type' <> 'passkey' OR (${table.purpose} = 'wallet-root' AND ${table.algorithm} = 'p256')`,
    ),
  ],
);
