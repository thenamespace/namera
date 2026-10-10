import type {
  ActorId,
  OrganizationId,
  SessionKeyInstallationId,
  SessionKeyOperationId,
  WalletId,
} from "@namera-ai/protocol";
import type { SessionKeyOperationEncoded } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, foreignKey, index, jsonb, text, unique, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId, timestamps } from "#/schema/common";

import { actor } from "../auth/actor.js";
import { coreSchema } from "./common.js";
import { sessionKeyInstallation } from "./session-key-installation.js";

type Operation = SessionKeyOperationEncoded;

export const sessionKeyOperation = coreSchema.table(
  "session_key_operation",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<SessionKeyOperationId>(),
    organizationId: text("organization_id").notNull().$type<OrganizationId>(),
    actorId: text("actor_id").notNull().$type<ActorId>(),
    installationId: text("installation_id").notNull().$type<SessionKeyInstallationId>(),
    walletId: text("wallet_id").notNull().$type<WalletId>(),
    chainId: text("chain_id").notNull().$type<Operation["chainId"]>(),
    kind: text("kind").notNull().$type<Operation["kind"]>(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    status: text("status").notNull().default("awaiting-signature").$type<Operation["status"]>(),
    data: jsonb("data").notNull().$type<Operation["data"]>(),
    expiresAt: createTimestampField("expires_at").notNull(),
    leaseToken: text("lease_token"),
    leaseExpiresAt: createTimestampField("lease_expires_at"),
    transactionHash: text("transaction_hash").$type<Operation["transactionHash"]>(),
    finishedAt: createTimestampField("finished_at"),
    ...timestamps,
  },
  (table) => [
    unique("session_operation_id_org_unique").on(table.id, table.organizationId),
    unique("session_operation_actor_idempotency_unique").on(
      table.organizationId,
      table.actorId,
      table.idempotencyKey,
    ),
    foreignKey({
      name: "session_operation_actor_org_fk",
      columns: [table.actorId, table.organizationId],
      foreignColumns: [actor.id, actor.organizationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "session_operation_installation_chain_org_fk",
      columns: [table.installationId, table.walletId, table.chainId, table.organizationId],
      foreignColumns: [
        sessionKeyInstallation.id,
        sessionKeyInstallation.walletId,
        sessionKeyInstallation.chainId,
        sessionKeyInstallation.organizationId,
      ],
    }).onDelete("restrict"),
    uniqueIndex("session_operation_one_pending_unique")
      .on(table.walletId, table.chainId)
      .where(sql`${table.status} IN ('awaiting-signature', 'signed', 'submitted')`),
    check("session_operation_kind_check", sql`${table.kind} IN ('install', 'uninstall')`),
    check(
      "session_operation_status_check",
      sql`${table.status} IN ('awaiting-signature', 'signed', 'submitted', 'confirmed', 'failed', 'expired')`,
    ),
    check(
      "session_operation_chain_check",
      sql`COALESCE(${table.data}->'prepared'->>'chainId' = ${table.chainId}, false)`,
    ),
    check(
      "session_operation_signature_state_check",
      sql`
    CASE WHEN ${table.status} IN ('awaiting-signature', 'expired')
      THEN COALESCE(${table.data}->'signed' = 'null'::jsonb, false)
      ELSE COALESCE(jsonb_typeof(${table.data}->'signed') = 'object', false)
    END`,
    ),
    // Completion can add a signature but cannot change any approved operation or billing field.
    check(
      "session_operation_signed_binding_check",
      sql`
    ${table.data}->'signed' = 'null'::jsonb OR COALESCE(
      ((${table.data}->'signed'->'userOperation') - 'signature') = ((${table.data}->'prepared'->'userOperation') - 'signature')
      AND ((${table.data}->'signed') - 'userOperation' - 'userOperationHash') = ((${table.data}->'prepared') - 'userOperation' - 'context'), false)`,
    ),
    check(
      "session_operation_receipt_check",
      sql`
    (${table.status} IN ('confirmed', 'failed')) = (${table.transactionHash} IS NOT NULL)
    AND (${table.status} IN ('confirmed', 'failed', 'expired')) = (${table.finishedAt} IS NOT NULL)`,
    ),
    check(
      "session_operation_lease_check",
      sql`
    (${table.leaseToken} IS NULL OR ${table.leaseExpiresAt} IS NOT NULL)
    AND (${table.status} IN ('awaiting-signature', 'signed', 'submitted') OR (${table.leaseToken} IS NULL AND ${table.leaseExpiresAt} IS NULL))`,
    ),
    index("session_operation_reconcile_idx").on(table.status, table.leaseExpiresAt),
    index("session_operation_expiry_idx")
      .on(table.expiresAt)
      .where(sql`${table.status} = 'awaiting-signature'`),
    index("session_operation_installation_created_idx").on(
      table.organizationId,
      table.installationId,
      table.createdAt,
    ),
  ],
);
