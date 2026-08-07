import type { VerificationId } from "@namera-ai/protocol";
import { text, index, uniqueIndex } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId, timestamps } from "#/schema/common";

import { authSchema } from "../common.js";

export const verification = authSchema.table(
  "verification",
  {
    id: text("id").primaryKey().$defaultFn(generateUniqueId).$type<VerificationId>(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: createTimestampField("expires_at").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("verification_value_uidx").on(table.value),
    index("verification_identifier_idx").on(table.identifier),
    index("verification_expires_at_idx").on(table.expiresAt),
  ],
);
