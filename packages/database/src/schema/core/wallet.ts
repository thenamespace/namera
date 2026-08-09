import type { ActorId, OrganizationId, WalletId, WalletKeyId } from "@namera-ai/protocol";
import type { Wallet, WalletEncoded } from "@namera-ai/protocol/model";
import { foreignKey, index, jsonb, text } from "drizzle-orm/pg-core";

import { generateUniqueId, timestamps } from "#/schema/common";

import { actor } from "../auth/actor.js";
import { organization } from "../auth/organization/organization.js";
import { coreSchema } from "./common.js";
import { walletKey } from "./wallet-key.js";

export const wallet = coreSchema.table(
  "wallet",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<WalletId>(),
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "restrict" }),
    walletKeyId: text("wallet_key_id").notNull().$type<WalletKeyId>(),
    metadata: jsonb("metadata").notNull().$type<Wallet["metadata"]>(),
    status: text("status").notNull().default("active").$type<Wallet["status"]>(),
    createdByActorId: text("created_by_actor_id").notNull().$type<ActorId>(),
    family: text("family").notNull().$type<Wallet["family"]>(),
    data: jsonb("data").notNull().$type<WalletEncoded["data"]>(),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      name: "wallet_key_organization_fk",
      columns: [table.walletKeyId, table.organizationId],
      foreignColumns: [walletKey.id, walletKey.organizationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "wallet_creator_organization_fk",
      columns: [table.createdByActorId, table.organizationId],
      foreignColumns: [actor.id, actor.organizationId],
    }).onDelete("restrict"),
    index("wallet_organization_status_idx").on(table.organizationId, table.status),
    index("wallet_wallet_key_idx").on(table.walletKeyId),
    index("wallet_created_by_actor_idx").on(table.createdByActorId),
  ],
);
