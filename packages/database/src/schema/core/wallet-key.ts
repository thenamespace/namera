import type { OrganizationId, WalletKeyId } from "@namera-ai/protocol";
import type { WalletKey } from "@namera-ai/protocol/model";
import { index, jsonb, text, unique } from "drizzle-orm/pg-core";

import { generateUniqueId, timestamps } from "#/schema/common";

import { organization } from "../auth/organization/organization.js";
import { coreSchema } from "./common.js";

export const walletKey = coreSchema.table(
  "wallet_key",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<WalletKeyId>(),
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "restrict" }),
    provider: text("provider").notNull().$type<WalletKey["provider"]>(),
    algorithm: text("algorithm").notNull().$type<WalletKey["algorithm"]>(),
    protectionLevel: text("protection_level").notNull().$type<WalletKey["protectionLevel"]>(),
    keyVersionName: text("key_version_name").notNull(),
    publicKeyHex: text("public_key_hex").notNull().$type<WalletKey["publicKeyHex"]>(),
    status: text("status").notNull().default("active").$type<WalletKey["status"]>(),
    data: jsonb("data").notNull().$type<WalletKey["data"]>(),
    ...timestamps,
  },
  (table) => [
    unique("wallet_key_id_organization_unique").on(table.id, table.organizationId),
    unique("wallet_key_provider_version_name_unique").on(table.provider, table.keyVersionName),
    index("wallet_key_organization_status_idx").on(table.organizationId, table.status),
  ],
);
