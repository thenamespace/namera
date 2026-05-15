import type {
  SerializedAccount,
  SessionKeyData,
  SessionKeyId,
  SessionKeyType,
  OrganizationId,
  SmartAccountId,
  UserId,
} from "@namera-ai/schema";

import { sql } from "drizzle-orm";
import { index, json, pgPolicy, pgTable, text } from "drizzle-orm/pg-core";

import { organization } from "../auth/organization";
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
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "cascade" }),
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
    index("session_key_organizationId_idx").on(table.organizationId),
    index("session_key_smartAccountId_idx").on(table.smartAccountId),
    pgPolicy("session_key_user_select", {
      as: "permissive",
      to: userRole,
      for: "select",
      using: sql`auth_org_has_access(${table.organizationId})`,
    }),
    pgPolicy("session_key_user_update", {
      as: "permissive",
      to: userRole,
      for: "update",
      using: sql`auth_org_has_role(${table.organizationId}, ARRAY['owner'])`,
      withCheck: sql`
        auth_org_has_role(${table.organizationId}, ARRAY['owner'])
        AND auth_smart_account_in_org(${table.smartAccountId}, ${table.organizationId})
      `,
    }),
    pgPolicy("session_key_user_insert", {
      as: "permissive",
      to: userRole,
      for: "insert",
      withCheck: sql`
        ${table.userId} = auth_user_id()
        AND auth_org_has_role(${table.organizationId}, ARRAY['owner', 'member'])
        AND auth_smart_account_in_org(${table.smartAccountId}, ${table.organizationId})
      `,
    }),
    pgPolicy("session_key_user_delete", {
      as: "permissive",
      to: userRole,
      for: "delete",
      using: sql`auth_org_has_role(${table.organizationId}, ARRAY['owner'])`,
    }),
    pgPolicy("session_key_admin_access", {
      as: "permissive",
      to: adminRole,
      for: "all",
      using: sql`true`,
    }),
  ],
);
