import { sql } from "drizzle-orm";
import { pgPolicy, text, uniqueIndex } from "drizzle-orm/pg-core";

import {
  adminRole,
  createTimestampField,
  generateUniqueId,
  timestamps,
  userRole,
} from "../common";
import { authSchema } from "./common";

export const verification = authSchema.table.withRLS(
  "verification",
  {
    expiresAt: createTimestampField("expires_at", {
      mode: "date",
      withTimezone: true,
    }),
    id: text("id").primaryKey().$defaultFn(generateUniqueId),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("verification_identifier_idx").on(table.identifier),
    pgPolicy("verification_user_select", {
      as: "permissive",
      to: userRole,
      for: "select",
      using: sql`true`,
    }),
    pgPolicy("verification_user_update", {
      as: "permissive",
      to: userRole,
      for: "update",
      using: sql`true`,
      withCheck: sql`true`,
    }),
    pgPolicy("verification_user_delete", {
      as: "permissive",
      to: userRole,
      for: "delete",
      using: sql`true`,
    }),
    pgPolicy("verification_user_insert", {
      as: "permissive",
      to: userRole,
      for: "insert",
      withCheck: sql`true`,
    }),
    pgPolicy("verification_admin_access", {
      as: "permissive",
      to: adminRole,
      for: "all",
      using: sql`true`,
    }),
  ],
);
