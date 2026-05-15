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
  pgPolicy,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { organization } from "../auth";
import { user } from "../auth/user";
import { adminRole, generateUniqueId, timestamps, userRole } from "../common";

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
    pgPolicy("smart_account_user_select", {
      as: "permissive",
      to: userRole,
      for: "select",
      using: sql`auth_org_has_access(${table.organizationId})`,
    }),
    pgPolicy("smart_account_user_insert", {
      as: "permissive",
      to: userRole,
      for: "insert",
      withCheck: sql`
        ${table.creatorId} = auth_user_id()
        AND auth_org_has_role(${table.organizationId}, ARRAY['owner', 'member'])
      `,
    }),
    pgPolicy("smart_account_user_update", {
      as: "permissive",
      to: userRole,
      for: "update",
      using: sql`auth_org_has_role(${table.organizationId}, ARRAY['owner'])`,
      withCheck: sql`auth_org_has_role(${table.organizationId}, ARRAY['owner'])`,
    }),
    pgPolicy("smart_account_user_delete", {
      as: "permissive",
      to: userRole,
      for: "delete",
      using: sql`auth_org_has_role(${table.organizationId}, ARRAY['owner'])`,
    }),
    pgPolicy("smart_account_admin_access", {
      as: "permissive",
      to: adminRole,
      for: "all",
      using: sql`true`,
    }),
  ],
);
