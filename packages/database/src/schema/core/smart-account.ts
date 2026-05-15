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
  onlyOrgMember,
  onlyOrgMemberWithRoles,
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
    // Only members of an organization can select it
    new PgPolicyBuilder()
      .name("smart_account_user_select")
      .as("permissive")
      .to(userRole)
      .forOperation("select")
      .using(onlyOrgMember(table.organizationId))
      .build(),
    // Only Org owners and admins can insert smart accounts, where creator is the current user
    new PgPolicyBuilder()
      .name("smart_account_owner_insert")
      .as("permissive")
      .to(userRole)
      .forOperation("insert")
      .withCheck(
        and([
          onlyUserId(table.creatorId),
          onlyOrgMemberWithRoles(table.organizationId, ["owner", "admin"]),
        ]),
      )
      .build(),
    // Only Org owners and admins can update smart accounts
    new PgPolicyBuilder()
      .name("smart_account_owner_update")
      .as("permissive")
      .to(userRole)
      .forOperation("update")
      .using(onlyOrgMemberWithRoles(table.organizationId, ["owner", "admin"]))
      .withCheck(
        onlyOrgMemberWithRoles(table.organizationId, ["owner", "admin"]),
      )
      .build(),
    // Only Org owners can delete smart accounts
    new PgPolicyBuilder()
      .name("smart_account_owner_delete")
      .as("permissive")
      .to(userRole)
      .forOperation("delete")
      .using(onlyOrgMemberWithRoles(table.organizationId, ["owner"]))
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
