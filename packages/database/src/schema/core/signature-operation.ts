import type {
  ActorId,
  OrganizationId,
  SessionKeyGrantId,
  SessionKeyId,
  SignatureOperationId,
  WalletId,
} from "@namera-ai/protocol";
import type { SignatureOperation, SignatureOperationEncoded } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, foreignKey, index, jsonb, text, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId, timestamps } from "#/schema/common";

import { actor } from "../auth/actor.js";
import { organization } from "../auth/organization/organization.js";
import { coreSchema } from "./common.js";
import { sessionKeyGrant } from "./session-key-grant.js";
import { sessionKey } from "./session-key.js";
import { wallet } from "./wallet.js";

export const signatureOperation = coreSchema.table(
  "signature_operation",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<SignatureOperationId>(),
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "restrict" }),
    actorId: text("actor_id").notNull().$type<ActorId>(),
    walletId: text("wallet_id").notNull().$type<WalletId>(),
    sessionKeyId: text("session_key_id").notNull().$type<SessionKeyId>(),
    sessionKeyGrantId: text("session_key_grant_id").notNull().$type<SessionKeyGrantId>(),
    namespace: text("namespace").notNull().$type<SignatureOperation["namespace"]>(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    policyHash: text("policy_hash").notNull(),
    status: text("status").notNull().default("reserved").$type<SignatureOperation["status"]>(),
    data: jsonb("data").notNull().$type<SignatureOperationEncoded["data"]>(),
    failureCode: text("failure_code").$type<NonNullable<SignatureOperation["failureCode"]>>(),
    reservationExpiresAt: createTimestampField("reservation_expires_at").notNull(),
    succeededAt: createTimestampField("succeeded_at"),
    failedAt: createTimestampField("failed_at"),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      name: "signature_operation_actor_organization_fk",
      columns: [table.actorId, table.organizationId],
      foreignColumns: [actor.id, actor.organizationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "signature_operation_wallet_organization_fk",
      columns: [table.walletId, table.organizationId],
      foreignColumns: [wallet.id, wallet.organizationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "signature_operation_session_key_wallet_organization_fk",
      columns: [table.sessionKeyId, table.walletId, table.organizationId],
      foreignColumns: [sessionKey.id, sessionKey.walletId, sessionKey.organizationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "signature_operation_grant_session_key_actor_organization_fk",
      columns: [table.sessionKeyGrantId, table.sessionKeyId, table.actorId, table.organizationId],
      foreignColumns: [
        sessionKeyGrant.id,
        sessionKeyGrant.sessionKeyId,
        sessionKeyGrant.actorId,
        sessionKeyGrant.organizationId,
      ],
    }).onDelete("restrict"),
    uniqueIndex("signature_operation_actor_idempotency_uidx").on(
      table.organizationId,
      table.actorId,
      table.idempotencyKey,
    ),
    index("signature_operation_organization_status_created_at_idx").on(
      table.organizationId,
      table.status,
      table.createdAt,
    ),
    index("signature_operation_wallet_created_at_idx").on(
      table.organizationId,
      table.walletId,
      table.createdAt,
    ),
    index("signature_operation_session_key_status_created_at_idx").on(
      table.organizationId,
      table.sessionKeyId,
      table.status,
      table.createdAt,
    ),
    index("signature_operation_actor_created_at_idx").on(
      table.organizationId,
      table.actorId,
      table.createdAt,
    ),
    check(
      "signature_operation_lifecycle_check",
      sql`(${table.status} = 'reserved' AND ${table.failureCode} IS NULL AND ${table.succeededAt} IS NULL AND ${table.failedAt} IS NULL) OR (${table.status} = 'succeeded' AND ${table.failureCode} IS NULL AND ${table.succeededAt} IS NOT NULL AND ${table.failedAt} IS NULL) OR (${table.status} = 'failed' AND ${table.failureCode} IS NOT NULL AND ${table.succeededAt} IS NULL AND ${table.failedAt} IS NOT NULL)`,
    ),
  ],
);
