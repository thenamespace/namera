import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-orm/effect-schema";
import { index, text } from "drizzle-orm/pg-core";

import { createTimestampField, generateUniqueId, timestamps } from "../common";
import { authSchema } from "./common";

export const verification = authSchema.table(
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
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const VerificationSchema = createSelectSchema(verification);
export const VerificationInsertSchema = createInsertSchema(verification);
export const VerificationUpdateSchema = createUpdateSchema(verification);

export type Verification = typeof VerificationSchema.Type;
export type VerificationInsert = typeof VerificationInsertSchema.Type;
export type VerificationUpdate = typeof VerificationUpdateSchema.Type;
