import type {
  OrganizationId,
  SessionKeyId,
  SessionKeyInstallationId,
  WalletId,
} from "@namera-ai/protocol";
import type { SessionKeyInstallationEncoded } from "@namera-ai/protocol/model";
import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, jsonb, text, unique } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId, timestamps } from "#/schema/common";

import { coreSchema } from "./common.js";
import { sessionKey } from "./session-key.js";

type Installation = SessionKeyInstallationEncoded;

export const sessionKeyInstallation = coreSchema.table(
  "session_key_installation",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<SessionKeyInstallationId>(),
    organizationId: text("organization_id").notNull().$type<OrganizationId>(),
    sessionKeyId: text("session_key_id").notNull().$type<SessionKeyId>(),
    walletId: text("wallet_id").notNull().$type<WalletId>(),
    namespace: text("namespace").notNull().$type<Installation["namespace"]>(),
    chainId: text("chain_id").notNull().$type<Installation["chainId"]>(),
    entityId: integer("entity_id").notNull(),
    configurationHash: text("configuration_hash")
      .notNull()
      .$type<Installation["configurationHash"]>(),
    data: jsonb("data").notNull().$type<Installation["data"]>(),
    status: text("status").notNull().default("pending").$type<Installation["status"]>(),
    installUserOperationHash: text("install_user_operation_hash").$type<
      Installation["installUserOperationHash"]
    >(),
    installTransactionHash: text("install_transaction_hash").$type<
      Installation["installTransactionHash"]
    >(),
    uninstallUserOperationHash: text("uninstall_user_operation_hash").$type<
      Installation["uninstallUserOperationHash"]
    >(),
    uninstallTransactionHash: text("uninstall_transaction_hash").$type<
      Installation["uninstallTransactionHash"]
    >(),
    installedAt: createTimestampField("installed_at"),
    revokedAt: createTimestampField("revoked_at"),
    ...timestamps,
  },
  (table) => [
    unique("session_installation_id_org_unique").on(table.id, table.organizationId),
    unique("session_installation_id_session_org_unique").on(
      table.id,
      table.sessionKeyId,
      table.organizationId,
    ),
    unique("session_installation_id_wallet_chain_org_unique").on(
      table.id,
      table.walletId,
      table.chainId,
      table.organizationId,
    ),
    unique("session_installation_session_chain_unique").on(
      table.organizationId,
      table.sessionKeyId,
      table.chainId,
    ),
    // Never reuse a validation entity, including after revocation (old signed operations may exist).
    unique("session_installation_wallet_chain_entity_unique").on(
      table.organizationId,
      table.walletId,
      table.chainId,
      table.entityId,
    ),
    foreignKey({
      name: "session_installation_session_wallet_org_fk",
      columns: [table.sessionKeyId, table.walletId, table.organizationId],
      foreignColumns: [sessionKey.id, sessionKey.walletId, sessionKey.organizationId],
    }).onDelete("restrict"),
    check(
      "session_installation_namespace_check",
      sql`${table.namespace} = 'eip155' AND ${table.chainId} ~ '^eip155:[1-9][0-9]*$'`,
    ),
    check(
      "session_installation_entity_check",
      sql`${table.entityId} BETWEEN 1 AND 2147483646 AND COALESCE((${table.data}->'authorization'->>'entityId')::integer = ${table.entityId}, false)`,
    ),
    check(
      "session_installation_status_check",
      sql`${table.status} IN ('pending', 'submitted', 'installed', 'revoking', 'revoked', 'failed')`,
    ),
    check(
      "session_installation_receipt_check",
      sql`
    (${table.status} NOT IN ('submitted', 'installed', 'revoking', 'revoked') OR ${table.installUserOperationHash} IS NOT NULL)
    AND (${table.status} NOT IN ('installed', 'revoking', 'revoked') OR (${table.installTransactionHash} IS NOT NULL AND ${table.installedAt} IS NOT NULL))
    AND (${table.status} <> 'revoked' OR (${table.uninstallUserOperationHash} IS NOT NULL AND ${table.uninstallTransactionHash} IS NOT NULL AND ${table.revokedAt} IS NOT NULL))
  `,
    ),
    index("session_installation_wallet_chain_status_idx").on(
      table.organizationId,
      table.walletId,
      table.chainId,
      table.status,
    ),
    index("session_installation_status_updated_idx").on(table.status, table.updatedAt),
  ],
);
