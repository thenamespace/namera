import type {
  EntrypointVersion,
  EthereumAddress,
  KernelVersion,
  SmartAccountOwnerType,
  UserId,
} from "@namera-ai/schema";
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgPolicy,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "../auth/user";
import { adminRole, generateUniqueId, timestamps, userRole } from "../common";

export const smartAccount = pgTable.withRLS(
  "smart_account",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId),
    userId: text("user_id")
      .notNull()
      .$type<UserId>()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name"),
    entryPointVersion: text("entrypoint_version")
      .notNull()
      .$type<EntrypointVersion>(),
    kernelVersion: text("kernel_version").notNull().$type<KernelVersion>(),
    index: integer("index").notNull(),
    address: text("address").notNull().$type<EthereumAddress>(),
    ownerType: text("owner_type").notNull().$type<SmartAccountOwnerType>(),
    ownerIdentifier: text("owner_identifier").notNull(),
    ...timestamps,
  },
  (table) => [
    index("smart_account_userId_idx").on(table.userId),
    uniqueIndex("smart_account_address_uidx").on(table.address),
    pgPolicy("smart_account_user_select", {
      as: "permissive",
      to: userRole,
      for: "select",
      using: sql`${table.userId} = auth_user_id()`,
    }),
    pgPolicy("smart_account_user_update", {
      as: "permissive",
      to: userRole,
      for: "update",
      using: sql`${table.userId} = auth_user_id()`,
      withCheck: sql`${table.userId} = auth_user_id()`,
    }),
    pgPolicy("smart_account_admin_access", {
      as: "permissive",
      to: adminRole,
      for: "all",
      using: sql`true`,
    }),
  ],
);
