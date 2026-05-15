import { text, uniqueIndex } from "drizzle-orm/pg-core";

import {
  adminRole,
  createTimestampField,
  generateUniqueId,
  timestamps,
} from "../common";
import { PgPolicyBuilder } from "../policy";
import { authSchema } from "./common";

// Verification Table
// This table is only managed by the admin, and is used store temporary verification codes
// like google linking state, email verification, etc.
export const verification = authSchema.table.withRLS(
  "verification",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: createTimestampField("expires_at", {
      mode: "date",
      withTimezone: true,
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("verification_identifier_idx").on(table.identifier),
    // Admins can access all verifications
    new PgPolicyBuilder()
      .name("verification_admin_access")
      .as("permissive")
      .to(adminRole)
      .forOperation("all")
      .using("true")
      .build(),
  ],
);
