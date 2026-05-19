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
import { index, json, pgTable, text } from "drizzle-orm/pg-core";

import { organization } from "@/schema/auth";
import { SessionKeyMetadata } from "@namera-ai/schema";

import { user } from "../auth/user";
import { adminRole, generateUniqueId, timestamps, userRole } from "../common";
import {
  and,
  onlyIfSessionKeyInOrg,
  onlyIfSmartAccountInOrg,
  onlyOrgMemberWithPermissions,
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
    smartAccountId: text("smart_account_id")
      .notNull()
      .$type<SmartAccountId>()
      .references(() => smartAccount.id, { onDelete: "cascade" }),
    serializedAccounts: json("serialized_accounts")
      .notNull()
      .$type<SerializedAccount[]>(),
    type: text("type").notNull().$type<SessionKeyType>(),
    data: json("data").notNull().$type<SessionKeyData>(),
    ...timestamps,
  },
  (table) => [
    index("session_key_organizationId_idx").on(table.organizationId),
    index("session_key_smartAccountId_idx").on(table.smartAccountId),
    index("session_key_creator_idx").on(table.creatorId),
    index("session_key_type_idx").on(table.type),
    // Only org members can select their own session keys
    new PgPolicyBuilder()
      .name("session_key_select")
      .as("permissive")
      .to(userRole)
      .forOperation("select")
      .using(
        onlyOrgMemberWithPermissions(table.organizationId, [
          "session_key:read",
        ]),
      )
      .build(),
    // Only org members with "session_key:update" permission can update session keys
    // only if session key and smart account belongs to org
    new PgPolicyBuilder()
      .name("session_key_update")
      .as("permissive")
      .to(userRole)
      .forOperation("update")
      .using(
        and([
          onlyOrgMemberWithPermissions(table.organizationId, [
            "session_key:update",
          ]),
          onlyIfSessionKeyInOrg(table.id, table.organizationId),
        ]),
      )
      .withCheck(
        and([
          onlyOrgMemberWithPermissions(table.organizationId, [
            "session_key:update",
          ]),
          onlyIfSmartAccountInOrg(table.smartAccountId, table.organizationId),
        ]),
      )
      .build(),
    // Only members with "session_key:create" permission can insert session keys
    // Only if creator is the current user, smart account belongs to org,
    new PgPolicyBuilder()
      .name("session_key_insert")
      .as("permissive")
      .to(userRole)
      .forOperation("insert")
      .withCheck(
        and([
          onlyUserId(table.creatorId),
          onlyOrgMemberWithPermissions(table.organizationId, [
            "session_key:create",
          ]),
          onlyIfSmartAccountInOrg(table.smartAccountId, table.organizationId),
        ]),
      )
      .build(),
    // Only members with "session_key:delete" permission can delete session keys
    // Only if session key belongs to org
    new PgPolicyBuilder()
      .name("session_key_delete")
      .as("permissive")
      .to(userRole)
      .forOperation("delete")
      .using(
        and([
          onlyOrgMemberWithPermissions(table.organizationId, [
            "session_key:delete",
          ]),
          onlyIfSessionKeyInOrg(table.id, table.organizationId),
        ]),
      )
      .build(),
    // Admins can access all session keys
    new PgPolicyBuilder()
      .name("session_key_admin_access")
      .as("permissive")
      .to(adminRole)
      .forOperation("all")
      .using(sql`true`)
      .build(),
  ],
);
