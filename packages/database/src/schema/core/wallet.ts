import type { ActorId, OrganizationId, SigningKeyId, WalletId } from "@namera-ai/protocol";
import type { Wallet, WalletEncoded } from "@namera-ai/protocol/model";
import { foreignKey, index, jsonb, text, unique } from "drizzle-orm/pg-core";

import { generateUniqueId, timestamps } from "#/schema/common";

import { actor } from "../auth/actor.js";
import { organization } from "../auth/organization/organization.js";
import { coreSchema } from "./common.js";
import { signingKey } from "./signing-key.js";

export const wallet = coreSchema.table(
  "wallet",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<WalletId>(),
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "restrict" }),
    signingKeyId: text("signing_key_id").notNull().$type<SigningKeyId>(),
    metadata: jsonb("metadata").notNull().$type<Wallet["metadata"]>(),
    status: text("status").notNull().default("active").$type<Wallet["status"]>(),
    createdByActorId: text("created_by_actor_id").notNull().$type<ActorId>(),
    namespace: text("namespace").notNull().$type<Wallet["namespace"]>(),
    data: jsonb("data").notNull().$type<WalletEncoded["data"]>(),
    ...timestamps,
  },
  (table) => [
    unique("wallet_id_organization_unique").on(table.id, table.organizationId),
    foreignKey({
      name: "wallet_signing_key_organization_fk",
      columns: [table.signingKeyId, table.organizationId],
      foreignColumns: [signingKey.id, signingKey.organizationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "wallet_creator_organization_fk",
      columns: [table.createdByActorId, table.organizationId],
      foreignColumns: [actor.id, actor.organizationId],
    }).onDelete("restrict"),
    index("wallet_organization_status_idx").on(table.organizationId, table.status),
    index("wallet_signing_key_idx").on(table.signingKeyId),
    index("wallet_created_by_actor_idx").on(table.createdByActorId),
  ],
);
