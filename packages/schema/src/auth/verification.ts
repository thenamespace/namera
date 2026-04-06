import { Schema } from "effect";

import { createInsertSchema, createUpdateSchema } from "@/helpers";

export const Verification = Schema.Struct({
  id: Schema.String,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
  expiresAt: Schema.Date,
  identifier: Schema.String,
  value: Schema.String,
});

export const VerificationUpdate = createUpdateSchema(Verification);
export const VerificationInsert = createInsertSchema(Verification, "identifier", "value");

export type Verification = typeof Verification.Type;
export type VerificationUpdate = typeof VerificationUpdate.Type;
export type VerificationInsert = typeof VerificationInsert.Type;
