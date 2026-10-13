import type {
  ActorId,
  OrganizationId,
  SignatureOperationId,
  SigningKeyId,
  WalletId,
} from "@namera-ai/protocol";
import type { WalletSignatureOperation } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, foreignKey, jsonb, text, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId, timestamps } from "#/schema/common";

import { actor } from "../auth/actor.js";
import { organization } from "../auth/organization/organization.js";
import { coreSchema } from "./common.js";
import { signingKey } from "./signing-key.js";
import { wallet } from "./wallet.js";

export const walletSignatureOperation = coreSchema.table(
  "wallet_signature_operation",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<SignatureOperationId>(),
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "restrict" }),
    actorId: text("actor_id").notNull().$type<ActorId>(),
    walletId: text("wallet_id").notNull().$type<WalletId>(),
    signingKeyId: text("signing_key_id").notNull().$type<SigningKeyId>(),
    ownerBinding: text("owner_binding").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    request: jsonb("request").notNull().$type<WalletSignatureOperation["request"]>(),
    status: text("status")
      .notNull()
      .default("prepared")
      .$type<WalletSignatureOperation["status"]>(),
    encryptedResult: text("encrypted_result"),
    leaseToken: text("lease_token"),
    leaseExpiresAt: createTimestampField("lease_expires_at"),
    expiresAt: createTimestampField("expires_at").notNull(),
    succeededAt: createTimestampField("succeeded_at"),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      name: "wallet_signature_actor_org_fk",
      columns: [table.actorId, table.organizationId],
      foreignColumns: [actor.id, actor.organizationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "wallet_signature_wallet_org_fk",
      columns: [table.walletId, table.organizationId],
      foreignColumns: [wallet.id, wallet.organizationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "wallet_signature_key_org_fk",
      columns: [table.signingKeyId, table.organizationId],
      foreignColumns: [signingKey.id, signingKey.organizationId],
    }).onDelete("restrict"),
    uniqueIndex("wallet_signature_actor_idempotency_uidx").on(
      table.organizationId,
      table.actorId,
      table.idempotencyKey,
    ),
    check(
      "wallet_signature_lifecycle_check",
      sql`(${table.status} = 'prepared' AND ${table.encryptedResult} IS NULL AND ${table.succeededAt} IS NULL) OR (${table.status} = 'succeeded' AND ${table.encryptedResult} IS NOT NULL AND ${table.succeededAt} IS NOT NULL)`,
    ),
    check(
      "wallet_signature_lease_check",
      sql`(${table.leaseToken} IS NULL AND ${table.leaseExpiresAt} IS NULL) OR (${table.status} = 'prepared' AND ${table.leaseToken} IS NOT NULL AND ${table.leaseExpiresAt} IS NOT NULL)`,
    ),
  ],
);
