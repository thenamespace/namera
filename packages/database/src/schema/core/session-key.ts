import type {
  SerializedAccount,
  SessionKeyData,
  SessionKeyId,
  SessionKeyType,
  SmartAccountId,
  UserId,
} from "@namera-ai/schema";

import { sql } from "drizzle-orm";
import { index, json, pgPolicy, pgTable, text } from "drizzle-orm/pg-core";

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
    type: text("type").notNull().$type<SessionKeyType>(),
    userId: text("user_id")
      .notNull()
      .$type<UserId>()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name"),
    smartAccountId: text("smart_account_id")
      .notNull()
      .$type<SmartAccountId>()
      .references(() => smartAccount.id, { onDelete: "cascade" }),
    serializedAccounts: json("serialized_accounts")
      .notNull()
      .$type<SerializedAccount[]>(),
    data: json("data").notNull().$type<SessionKeyData>(),
    ...timestamps,
  },
  (table) => [
    index("session_key_userId_idx").on(table.userId),
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
