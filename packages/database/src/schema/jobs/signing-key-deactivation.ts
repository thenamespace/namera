import type { OrganizationId, SigningKeyId } from "@namera-ai/protocol";
import type { SigningKeyDeactivation } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, text, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId, timestamps } from "#/schema/common";
import { signingKey } from "#/schema/core/signing-key";

import { jobsSchema } from "./common.js";

export const signingKeyDeactivation = jobsSchema.table(
  "signing_key_deactivation",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId),
    organizationId: text("organization_id").notNull().$type<OrganizationId>(),
    signingKeyId: text("signing_key_id").notNull().$type<SigningKeyId>(),
    status: text("status").notNull().default("pending").$type<SigningKeyDeactivation["status"]>(),
    attempts: integer("attempts").notNull().default(0),
    availableAt: createTimestampField("available_at").notNull().defaultNow(),
    leaseToken: text("lease_token"),
    leaseExpiresAt: createTimestampField("lease_expires_at"),
    lastErrorCode: text("last_error_code").$type<SigningKeyDeactivation["lastErrorCode"]>(),
    completedAt: createTimestampField("completed_at"),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      name: "signing_key_deactivation_signer_org_fk",
      columns: [table.signingKeyId, table.organizationId],
      foreignColumns: [signingKey.id, signingKey.organizationId],
    }).onDelete("restrict"),
    uniqueIndex("signing_key_deactivation_signer_org_uidx").on(
      table.signingKeyId,
      table.organizationId,
    ),
    index("signing_key_deactivation_due_idx")
      .on(table.availableAt, table.id)
      .where(sql`${table.status} = 'pending'`),
    index("signing_key_deactivation_lease_idx")
      .on(table.leaseExpiresAt)
      .where(sql`${table.status} = 'pending'`),
    check(
      "signing_key_deactivation_status_check",
      sql`${table.status} IN ('pending', 'completed', 'needs-attention')`,
    ),
    check("signing_key_deactivation_attempts_check", sql`${table.attempts} >= 0`),
    check(
      "signing_key_deactivation_lease_check",
      sql`(${table.leaseToken} IS NULL) = (${table.leaseExpiresAt} IS NULL)
        AND (${table.status} = 'pending' OR ${table.leaseToken} IS NULL)`,
    ),
    check(
      "signing_key_deactivation_completed_check",
      sql`(${table.status} = 'completed') = (${table.completedAt} IS NOT NULL)`,
    ),
  ],
);
