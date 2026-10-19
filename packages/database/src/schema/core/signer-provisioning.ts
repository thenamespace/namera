import type {
  ActorId,
  CredentialId,
  OrganizationId,
  SignerProvisioningId,
  SigningKeyId,
} from "@namera-ai/protocol";
import type { SignerProvisioningEncoded } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, foreignKey, index, jsonb, text, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField, timestamps } from "#/schema/common";

import { actor } from "../auth/actor.js";
import { coreSchema } from "./common.js";

export const signerProvisioning = coreSchema.table(
  "signer_provisioning",
  {
    id: text("id").primaryKey().$type<SignerProvisioningId>(),
    organizationId: text("organization_id").notNull().$type<OrganizationId>(),
    actorId: text("actor_id").notNull().$type<ActorId>(),
    provider: text("provider").notNull(),
    purpose: text("purpose").notNull().$type<SignerProvisioningEncoded["purpose"]>(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    // Planned identifiers exist before the resources, so these are not foreign keys.
    signingKeyId: text("signing_key_id").notNull().$type<SigningKeyId>(),
    credentialId: text("credential_id").notNull().$type<CredentialId>(),
    status: text("status").notNull().$type<SignerProvisioningEncoded["status"]>(),
    stage: text("stage").notNull(),
    checkpoint: jsonb("checkpoint")
      .notNull()
      .default({})
      .$type<NonNullable<SignerProvisioningEncoded["checkpoint"]>>(),
    signer: jsonb("signer").$type<SignerProvisioningEncoded["signer"]>(),
    resourceId: text("resource_id"),
    leaseToken: text("lease_token"),
    leaseExpiresAt: createTimestampField("lease_expires_at"),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.actorId, table.organizationId],
      foreignColumns: [actor.id, actor.organizationId],
    }).onDelete("restrict"),
    uniqueIndex("signer_provisioning_request_uidx").on(
      table.organizationId,
      table.actorId,
      table.provider,
      table.purpose,
      table.idempotencyKey,
    ),
    uniqueIndex("signer_provisioning_signing_key_uidx").on(table.signingKeyId),
    uniqueIndex("signer_provisioning_credential_uidx").on(table.credentialId),
    index("signer_provisioning_recovery_idx").on(
      table.organizationId,
      table.status,
      table.createdAt,
    ),
    check(
      "signer_provisioning_status_check",
      sql`${table.status} IN ('pending', 'remote_started', 'ready', 'recovery_required', 'completed')`,
    ),
    check("signer_provisioning_purpose_check", sql`${table.purpose} IN ('wallet-root', 'session')`),
    check(
      "signer_provisioning_lease_check",
      sql`(${table.leaseToken} IS NULL) = (${table.leaseExpiresAt} IS NULL)`,
    ),
    check(
      "signer_provisioning_result_check",
      sql`(${table.status} = 'completed') = (${table.resourceId} IS NOT NULL)`,
    ),
    check(
      "signer_provisioning_signer_check",
      sql`(${table.status} IN ('ready', 'completed')) = (${table.signer} IS NOT NULL)`,
    ),
  ],
);
