import type {
  EthereumAddress,
  SessionKeyId,
  SmartAccountId,
  SupportedChain,
  UserId,
} from "@namera-ai/schema";
import { sql } from "drizzle-orm";
import {
  index,
  pgPolicy,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "../auth/user";
import { adminRole, generateUniqueId, timestamps, userRole } from "../common";
import { smartAccount } from "./smart-account";

export const sessionKey = pgTable.withRLS(
  "session_key",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(generateUniqueId)
      .$type<SessionKeyId>(),
    userId: text("user_id")
      .notNull()
      .$type<UserId>()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name"),
    address: text("address").notNull().$type<EthereumAddress>(),
    smartAccountId: text("smart_account_id")
      .notNull()
      .$type<SmartAccountId>()
      .references(() => smartAccount.id, { onDelete: "cascade" }),
    serializedAccount: text("serialized_account").notNull(),
    encSessionPrivateKey: text("enc_session_private_key").notNull(),
    chain: text("chain").notNull().$type<SupportedChain>(),
    ...timestamps,
  },
  (table) => [
    index("session_key_userId_idx").on(table.userId),
    uniqueIndex("session_key_address_uidx").on(table.address),
    pgPolicy("session_key_user_select", {
      as: "permissive",
      to: userRole,
      for: "select",
      using: sql`${table.userId} = auth_user_id()`,
    }),
    pgPolicy("session_key_user_update", {
      as: "permissive",
      to: userRole,
      for: "update",
      using: sql`${table.userId} = auth_user_id()`,
      withCheck: sql`${table.userId} = auth_user_id()`,
    }),
    pgPolicy("session_key_user_insert", {
      as: "permissive",
      to: userRole,
      for: "insert",
      using: sql`${table.userId} = auth_user_id()`,
      withCheck: sql`${table.userId} = auth_user_id()`,
    }),
    pgPolicy("session_key_user_delete", {
      as: "permissive",
      to: userRole,
      for: "delete",
      using: sql`${table.userId} = auth_user_id()`,
    }),
    pgPolicy("session_key_admin_access", {
      as: "permissive",
      to: adminRole,
      for: "all",
      using: sql`true`,
    }),
  ],
);
