import type {
  EntrypointVersion,
  EthereumAddress,
  KernelVersion,
  SmartAccountId,
  OwnerType,
  UserId,
  SmartAccountOwner,
  SmartAccountMetadata,
  OrganizationId,
} from "@namera-ai/schema";

import { sql } from "drizzle-orm";
import {
  index,
  integer,
  json,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { organization } from "../auth";
import { user } from "../auth/user";
import { adminRole, generateUniqueId, timestamps, userRole } from "../common";
import {
  and,
  onlyOrgMemberWithPermissions,
  onlyUserId,
  PgPolicyBuilder,
} from "../policy";

// Smart Accounts table
// Represents a org's smart account in Namera
export const smartAccount = pgTable.withRLS(
  "smart_account",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(generateUniqueId)
      .$type<SmartAccountId>(),
    organizationId: text("organization_id")
      .notNull()
      .$type<OrganizationId>()
      .references(() => organization.id, { onDelete: "cascade" }),
    creatorId: text("creator_id")
      .notNull()
      .$type<UserId>()
      .references(() => user.id, { onDelete: "no action" }),
    metadata: json("metadata").notNull().$type<SmartAccountMetadata>(),
    entryPointVersion: text("entrypoint_version")
      .notNull()
      .$type<EntrypointVersion>(),
    kernelVersion: text("kernel_version").notNull().$type<KernelVersion>(),
    index: integer("index").notNull(),
    address: text("address").notNull().$type<EthereumAddress>(),
    ownerType: text("owner_type").notNull().$type<OwnerType>(),
    owner: text("owner").notNull().$type<SmartAccountOwner>(),
    ...timestamps,
  },
  (table) => [
    index("smart_account_organizationId_idx").on(table.organizationId),
    index("smart_account_creatorId_idx").on(table.creatorId),
    index("smart_account_owner_index_idx").on(table.owner, table.index.desc()),
    uniqueIndex("smart_account_address_uidx").on(table.address),
    // Only members with "smart_account:read" permission can select it
    new PgPolicyBuilder()
      .name("smart_account_select")
      .as("permissive")
      .to(userRole)
      .forOperation("select")
      .using(
        onlyOrgMemberWithPermissions(table.organizationId, [
          "smart_account:read",
        ]),
      )
      .build(),
    // Only members with "smart_account:create" permission can create smart accounts
    new PgPolicyBuilder()
      .name("smart_account_insert")
      .as("permissive")
      .to(userRole)
      .forOperation("insert")
      .withCheck(
        and([
          onlyUserId(table.creatorId),
          onlyOrgMemberWithPermissions(table.organizationId, [
            "smart_account:create",
          ]),
        ]),
      )
      .build(),
    // Only members with "smart_account:update" permission can update smart accounts
    new PgPolicyBuilder()
      .name("smart_account_owner_update")
      .as("permissive")
      .to(userRole)
      .forOperation("update")
      .using(
        onlyOrgMemberWithPermissions(table.organizationId, [
          "smart_account:update",
        ]),
      )
      .withCheck(
        onlyOrgMemberWithPermissions(table.organizationId, [
          "smart_account:update",
        ]),
      )
      .build(),
    // Only members with "smart_account:delete" permission can delete smart accounts
    new PgPolicyBuilder()
      .name("smart_account_owner_delete")
      .as("permissive")
      .to(userRole)
      .forOperation("delete")
      .using(
        onlyOrgMemberWithPermissions(table.organizationId, [
          "smart_account:delete",
        ]),
      )
      .build(),
    // Admins can access all smart accounts
    new PgPolicyBuilder()
      .name("smart_account_admin_access")
      .as("permissive")
      .to(adminRole)
      .forOperation("all")
      .using(sql`true`)
      .build(),
  ],
);
