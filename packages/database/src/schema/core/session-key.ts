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
import { foreignKey, index, json, pgTable, text } from "drizzle-orm/pg-core";

import { organization } from "@/schema/auth";
import { SessionKeyMetadata } from "@namera-ai/schema";

import { user } from "../auth/user";
import { adminRole, generateUniqueId, timestamps, userRole } from "../common";
import {
  and,
  onlyIfSmartAccountInOrg,
  onlyActorWithOrgAccess,
  onlyIfNotDeleted,
  onlyUserId,
  PgPolicyBuilder,
} from "../policy";
import { smartAccount } from "./smart-account";

// Session Keys table
// Represents session keys associated with a org's smart account
export const sessionKey = pgTable.withRLS(
  "session_key",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(generateUniqueId)
      .$type<SessionKeyId>(),
    metadata: json("metadata").notNull().$type<SessionKeyMetadata>(),
    creatorId: text("creator_id")
      .notNull()
      .$type<UserId>()
      .references(() => user.id, { onDelete: "no action" }),
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "cascade" }),
    smartAccountId: text("smart_account_id").notNull().$type<SmartAccountId>(),
    serializedAccounts: json("serialized_accounts")
      .notNull()
      .$type<SerializedAccount[]>(),
    type: text("type").notNull().$type<SessionKeyType>(),
    data: json("data").notNull().$type<SessionKeyData>(),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.organizationId, table.smartAccountId],
      foreignColumns: [smartAccount.organizationId, smartAccount.id],
      name: "session_key_organization_smart_account_fk",
    }),
    index("session_key_organizationId_idx").on(table.organizationId),
    index("session_key_smartAccountId_idx").on(table.smartAccountId),
    index("session_key_organization_smartAccount_idx").on(
      table.organizationId,
      table.smartAccountId,
    ),
    index("session_key_creator_idx").on(table.creatorId),
    index("session_key_type_idx").on(table.type),
    new PgPolicyBuilder()
      .name("session_key_select")
      .as("permissive")
      .to(userRole)
      .forOperation("select")
      .using(
        and([
          onlyActorWithOrgAccess(table.organizationId),
          onlyIfNotDeleted(table.deletedAt),
        ]),
      )
      .build(),
    new PgPolicyBuilder()
      .name("session_key_update")
      .as("permissive")
      .to(userRole)
      .forOperation("update")
      .using(
        and([
          onlyActorWithOrgAccess(table.organizationId),
          onlyIfNotDeleted(table.deletedAt),
        ]),
      )
      .withCheck(
        and([
          onlyActorWithOrgAccess(table.organizationId),
          onlyIfSmartAccountInOrg(table.smartAccountId, table.organizationId),
          onlyIfNotDeleted(table.deletedAt),
        ]),
      )
      .build(),
    new PgPolicyBuilder()
      .name("session_key_insert")
      .as("permissive")
      .to(userRole)
      .forOperation("insert")
      .withCheck(
        and([
          onlyUserId(table.creatorId),
          onlyActorWithOrgAccess(table.organizationId),
          onlyIfSmartAccountInOrg(table.smartAccountId, table.organizationId),
          onlyIfNotDeleted(table.deletedAt),
        ]),
      )
      .build(),
    new PgPolicyBuilder()
      .name("session_key_admin_access")
      .as("permissive")
      .to(adminRole)
      .forOperation("all")
      .using(sql`true`)
      .build(),
  ],
);
