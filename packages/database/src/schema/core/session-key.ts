import type { ActorId, OrganizationId, SessionKeyId, WalletId } from "@namera-ai/protocol";
import type { SessionKey, SessionKeyEncoded } from "@namera-ai/protocol/model";
import { foreignKey, index, jsonb, text, unique } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId } from "#/schema/common";

import { actor } from "../auth/actor.js";
import { organization } from "../auth/organization/organization.js";
import { coreSchema } from "./common.js";
import { wallet } from "./wallet.js";

export const sessionKey = coreSchema.table(
  "session_key",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<SessionKeyId>(),
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "restrict" }),
    walletId: text("wallet_id").notNull().$type<WalletId>(),
    createdByActorId: text("created_by_actor_id").notNull().$type<ActorId>(),
    namespace: text("namespace").notNull().$type<SessionKey["namespace"]>(),
    metadata: jsonb("metadata").notNull().$type<SessionKey["metadata"]>(),
    policies: jsonb("policies").notNull().$type<SessionKeyEncoded["policies"]>(),
    policyHash: text("policy_hash").notNull(),
    status: text("status").notNull().default("active").$type<SessionKey["status"]>(),
    revokedAt: createTimestampField("revoked_at"),
    revokedByActorId: text("revoked_by_actor_id").$type<ActorId>(),
    createdAt: createTimestampField("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("session_key_id_organization_unique").on(table.id, table.organizationId),
    foreignKey({
      name: "session_key_wallet_organization_fk",
      columns: [table.walletId, table.organizationId],
      foreignColumns: [wallet.id, wallet.organizationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "session_key_creator_organization_fk",
      columns: [table.createdByActorId, table.organizationId],
      foreignColumns: [actor.id, actor.organizationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "session_key_revoker_organization_fk",
      columns: [table.revokedByActorId, table.organizationId],
      foreignColumns: [actor.id, actor.organizationId],
    }).onDelete("restrict"),
    index("session_key_organization_wallet_status_idx").on(
      table.organizationId,
      table.walletId,
      table.status,
    ),
    index("session_key_creator_organization_idx").on(table.createdByActorId, table.organizationId),
    index("session_key_revoker_organization_idx").on(table.revokedByActorId, table.organizationId),
  ],
);
